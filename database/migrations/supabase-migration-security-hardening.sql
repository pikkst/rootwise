-- ============================================================
-- Rootwise — Security & Performance Hardening Migration
-- Käsitsi sisestada: Supabase Dashboard → SQL Editor
--
-- Sisaldab:
--   1. RLS + trigger: quest_members.proof_verified kaitse
--   2. profiles.last_seen_at — täpne activeUsers7d mõõdik
--   3. Indeksid: fetchCandidateProfiles skaleerimiseks
-- ============================================================


-- ============================================================
-- 1. RLS — quest_members.proof_verified rollipiirang
--
-- Eesmärk: ainult creator või mentor saab proof_verified = true seada.
-- Lähenemisviis: BEFORE UPDATE trigger (täpsem kui RLS, sest saab
-- kontrollida, mis konkreetselt muutub — üksiku veeru tasemel kaitset
-- RLS üksi ei toeta).
-- ============================================================

-- 1a. Trigger-funktsioon: blokeerib proof_verified muutuse mittevolitatud kasutajatelt
CREATE OR REPLACE FUNCTION prevent_unauthorized_proof_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kui proof_verified muutub (sealhulgas NULL → false → true kõik suunad)
  IF NEW.proof_verified IS DISTINCT FROM OLD.proof_verified THEN
    -- Kontrolli, kas kutsuv kasutaja on selle questi creator või mentor
    IF NOT EXISTS (
      SELECT 1
      FROM quest_members qm
      WHERE qm.quest_id = NEW.quest_id
        AND qm.user_id = auth.uid()
        AND qm.role IN ('creator', 'mentor')
    ) THEN
      RAISE EXCEPTION 'permission_denied: ainult creator või mentor saab proof_verified muuta'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger quest_members tabelil
DROP TRIGGER IF EXISTS tg_guard_proof_verified ON quest_members;
CREATE TRIGGER tg_guard_proof_verified
  BEFORE UPDATE ON quest_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unauthorized_proof_verify();


-- 1b. RLS poliitikad quest_members tabelil
-- (Lisaks triggerile — kaitsekihtide põhimõte)

ALTER TABLE quest_members ENABLE ROW LEVEL SECURITY;

-- SELECT: näed oma ridu + kõiki oma questi liikmeid
DROP POLICY IF EXISTS "qm_select" ON quest_members;
CREATE POLICY "qm_select"
  ON quest_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR quest_id IN (
      SELECT quest_id FROM quest_members qm2 WHERE qm2.user_id = auth.uid()
    )
  );

-- INSERT: saad lisada enda rea (kutse vastuvõtmisel / joinides)
DROP POLICY IF EXISTS "qm_insert_self" ON quest_members;
CREATE POLICY "qm_insert_self"
  ON quest_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE (enda rida): liige uuendab enda staatust, tõendab proof jne
-- proof_verified muutus on kaitstud triggeriga (tg_guard_proof_verified)
DROP POLICY IF EXISTS "qm_update_self" ON quest_members;
CREATE POLICY "qm_update_self"
  ON quest_members FOR UPDATE
  USING (user_id = auth.uid());

-- UPDATE (teiste read): creator/mentor saab uuendada kõiki oma questi liikmeid
-- (näiteks proof_verified seadmine, rolli muutus)
DROP POLICY IF EXISTS "qm_update_as_moderator" ON quest_members;
CREATE POLICY "qm_update_as_moderator"
  ON quest_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM quest_members qm
      WHERE qm.quest_id = quest_members.quest_id
        AND qm.user_id = auth.uid()
        AND qm.role IN ('creator', 'mentor')
    )
  );

-- DELETE: ainult enda rida (questist lahkumine)
DROP POLICY IF EXISTS "qm_delete_self" ON quest_members;
CREATE POLICY "qm_delete_self"
  ON quest_members FOR DELETE
  USING (user_id = auth.uid());


-- 1c. Abifunktsioon (SECURITY DEFINER): frontend kutsub otse ilma RLS-i
--     piiranguteta — sisemiselt kontrollib rollid ise.
--     Kasuta: supabase.rpc('verify_quest_member_proof', { ... })
CREATE OR REPLACE FUNCTION verify_quest_member_proof(
  p_quest_id       UUID,
  p_member_user_id UUID,
  p_verified       BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Volituse kontroll
  IF NOT EXISTS (
    SELECT 1 FROM quest_members
    WHERE quest_id = p_quest_id
      AND user_id  = auth.uid()
      AND role     IN ('creator', 'mentor')
  ) THEN
    RAISE EXCEPTION 'permission_denied: ainult creator või mentor saab tõendit kinnitada'
      USING ERRCODE = '42501';
  END IF;

  -- Tee uuendus teenindaja õigustega (möödub RLS-st)
  UPDATE quest_members
  SET
    proof_verified    = p_verified,
    proof_verified_by = auth.uid(),
    proof_verified_at = CASE WHEN p_verified THEN now() ELSE NULL END
  WHERE quest_id = p_quest_id
    AND user_id  = p_member_user_id;
END;
$$;

-- Anna authenticated kasutajatele käivitusõigus
GRANT EXECUTE ON FUNCTION verify_quest_member_proof TO authenticated;


-- ============================================================
-- 2. profiles.last_seen_at — täpne sessioonipõhine aktiivsus
--
-- Probleem: activeUsers7d kasutas profiles.updated_at, mis uueneb
--           ka profiili muutmisel — ei peegelda tegelikku sessiooni.
-- Lahendus: eraldi last_seen_at veerg + sünkroniseerimine auth.users
--           last_sign_in_at-ga sisselogimisel.
-- ============================================================

-- 2a. Lisa veerg
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 2b. Tagasitäide — sünkroniseeri olemasolevad väärtused auth.users põhjal
UPDATE profiles p
SET last_seen_at = au.last_sign_in_at
FROM auth.users au
WHERE au.id = p.id
  AND au.last_sign_in_at IS NOT NULL
  AND (p.last_seen_at IS NULL OR p.last_seen_at < au.last_sign_in_at);

-- 2c. Index AdminPage päringule (activeUsers7d)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON profiles (last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

-- 2d. RPC: frontend kutsub rakenduse laadimisel / fookust saades
--     (kerge, ~1ms) — uuendab last_seen_at = now()
--     Kasuta: supabase.rpc('update_last_seen') — kutsu AuthContext-is
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_seen_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_last_seen TO authenticated;

-- 2e. Trigger: sünkroniseeri last_seen_at sisselogimisel automaatselt
--     (täiendab 2d lahendust — töötab ka siis, kui frontend ei kutsu RPC-d)
CREATE OR REPLACE FUNCTION auth_sync_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tule rakenduma ainult kui last_sign_in_at päriselt muutus
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE profiles
    SET last_seen_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_login_sync_last_seen ON auth.users;
CREATE TRIGGER on_auth_login_sync_last_seen
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth_sync_last_seen();


-- ============================================================
-- 3. Indeksid — fetchCandidateProfiles skaleerimiseks
--
-- Praegu loetakse iga chat sõnumiga:
--   - kuni 100 profiili  (profiles tabel)
--   - kuni 300 asukohta  (profile_locations JOIN locations)
-- Indeksid kiirendavad neid päringuid oluliselt suurema kasutajabaasi korral.
-- ============================================================

-- 3a. GIN-indeks skills massiivil
--     Toetab: .not('skills', 'is', null) + tulevased array contains päringud
CREATE INDEX IF NOT EXISTS idx_profiles_skills_gin
  ON profiles USING GIN (skills);

-- 3b. Partial index: ainult profiilidele kellel on skills (vähendab indeksi suurust)
--     Toetab: .neq('id', uid).not('skills', 'is', null).limit(100)
CREATE INDEX IF NOT EXISTS idx_profiles_id_has_skills
  ON profiles (id)
  WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;

-- 3c. GIN-indeks interests massiivil (tulevasteks matching päringuteks)
CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin
  ON profiles USING GIN (interests);

-- 3d. profile_locations: kiire JOIN profile_id + visibility filtriga
--     Toetab: .eq('visibility', 'public').in('profile_id', [...ids])
CREATE INDEX IF NOT EXISTS idx_profile_locations_visibility_pid
  ON profile_locations (visibility, profile_id);

-- 3e. profile_locations: IN (...profileIds) päring
CREATE INDEX IF NOT EXISTS idx_profile_locations_profile_id
  ON profile_locations (profile_id);

-- 3f. last_seen_at (juba loodud sektsioonis 2c, siin dokumentatsiooni jaoks märgitud)
-- CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at DESC);


-- ============================================================
-- Kokkuvõte — mida siin tehti:
--
-- quest_members:
--   ✓ BEFORE UPDATE trigger blokeerib proof_verified muutuse ilma creator/mentor rollita
--   ✓ RLS poliiikad: SELECT, INSERT, UPDATE (ise + moderaatorina), DELETE
--   ✓ verify_quest_member_proof() RPC — turvaline frontendi kutse
--
-- profiles:
--   ✓ last_seen_at TIMESTAMPTZ veerg
--   ✓ Tagasitäide auth.users.last_sign_in_at põhjal
--   ✓ update_last_seen() RPC — kutsu AuthContext-is rakenduse laadimisel
--   ✓ Trigger: auto-sünk auth sisselogimisel
--   ✓ INDEX idx_profiles_last_seen_at
--
-- Indeksid:
--   ✓ idx_profiles_skills_gin (GIN)
--   ✓ idx_profiles_id_has_skills (partial)
--   ✓ idx_profiles_interests_gin (GIN)
--   ✓ idx_profile_locations_visibility_pid
--   ✓ idx_profile_locations_profile_id
-- ============================================================
