-- ============================================================
-- platform_events — sündmuste logi analüütika jaoks
-- Käsitsi sisestada: Supabase Dashboard → SQL Editor
--
-- Otstarve: "hot lead" tuvastamine (kes jõuab video limiidini 3x nädalas)
--           + konversioonilehtri analüüs (upgrade_cta_clicked vs purchase)
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_events (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,                          -- sündmuse nimi, nt 'video_limit_reached'
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}',            -- paindlik metadata
  url        TEXT,                                   -- lehekülg kus sündmus toimus
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeks analüüsipäringute jaoks
CREATE INDEX IF NOT EXISTS idx_platform_events_name_user
  ON platform_events (name, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at
  ON platform_events (created_at DESC);

-- RLS: kasutaja näeb ainult oma sündmusi; admin näeb kõiki
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_insert_own" ON platform_events;
CREATE POLICY "pe_insert_own"
  ON platform_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "pe_select_own" ON platform_events;
CREATE POLICY "pe_select_own"
  ON platform_events FOR SELECT
  USING (user_id = auth.uid());

-- Admin vaade: kõik sündmused (AdminPage kasutab service_role clienti)
-- (service_role möödub RLS-ist automaatselt — ei vaja eraldi poliitikat)


-- ============================================================
-- "Hot lead" päring — kopeeri AdminPage või AnalyticsPage-sse
--
-- SELECT
--   user_id,
--   COUNT(*) AS video_limit_hits,
--   MAX(created_at) AS last_hit,
--   p.name AS user_name,
--   p.plan
-- FROM platform_events pe
-- JOIN profiles p ON p.id = pe.user_id
-- WHERE pe.name = 'video_limit_reached'
--   AND pe.created_at > now() - interval '7 days'
-- GROUP BY pe.user_id, p.name, p.plan
-- HAVING COUNT(*) >= 2
-- ORDER BY video_limit_hits DESC;
-- ============================================================
