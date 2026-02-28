-- ============================================================
-- Rootwise — platform_admins RLS Hardening
-- Audit leid K1: admin-kontroll oli ainult client-side
--
-- Probleem: kui platform_admins tabelil puudub SELECT RLS,
-- saab iga autentitud kasutaja kontrollida teiste admin-staatust
-- (või potentsiaalselt ise oma rida sisestada).
--
-- Lahendus:
--   1. Luba tavakasutajal lugeda AINULT oma enda rida
--      → AdminPage.tsx fetchAdmin() töötab edasi
--   2. Blokeeri INSERT/UPDATE/DELETE kõigile peale service_role
--      → Administraatoreid saab lisada ainult Supabase Dashboard'ist
--        või service_role kaudu (mitte kliendist)
-- ============================================================

-- 1. Enable RLS (kui pole juba lubatud)
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- 2. SELECT — kasutaja näeb ainult oma rida
--    (AdminPage kontrollib: SELECT ... WHERE user_id = auth.uid())
DROP POLICY IF EXISTS "platform_admins_select_own" ON platform_admins;
CREATE POLICY "platform_admins_select_own"
  ON platform_admins
  FOR SELECT
  USING (user_id = auth.uid());

-- 3. INSERT — keelatud kliendipoolsetele rollidele
--    (kasuta Supabase Dashboard → SQL Editor admin lisamiseks)
DROP POLICY IF EXISTS "platform_admins_insert_deny" ON platform_admins;
CREATE POLICY "platform_admins_insert_deny"
  ON platform_admins
  FOR INSERT
  WITH CHECK (false);

-- 4. UPDATE — keelatud kliendipoolsetele rollidele
DROP POLICY IF EXISTS "platform_admins_update_deny" ON platform_admins;
CREATE POLICY "platform_admins_update_deny"
  ON platform_admins
  FOR UPDATE
  USING (false);

-- 5. DELETE — keelatud kliendipoolsetele rollidele
DROP POLICY IF EXISTS "platform_admins_delete_deny" ON platform_admins;
CREATE POLICY "platform_admins_delete_deny"
  ON platform_admins
  FOR DELETE
  USING (false);

-- ============================================================
-- JUHEND: Uue admini lisamine (käsitsi, service_role kaudu):
--
--   INSERT INTO platform_admins (user_id, role, created_by)
--   VALUES ('<user-uuid>', 'admin', '<super-admin-uuid>');
--
-- Tee seda Supabase Dashboard → SQL Editor (service_role'iga),
-- MITTE kliendi koodist.
-- ============================================================
