-- ============================================================
-- Rootwise hotfix: quest_members RLS recursion (500 on SELECT/HEAD)
--
-- Symptom:
--   PostgREST query on quest_members returns 500 due to self-referential
--   policy recursion.
--
-- Fix:
--   Replace direct self-subquery in qm_select policy with SECURITY DEFINER
--   helper function.
-- ============================================================

ALTER TABLE quest_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION can_view_quest_members(p_quest_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM quest_members qm
    WHERE qm.quest_id = p_quest_id
      AND qm.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION can_view_quest_members(UUID) FROM public;
GRANT EXECUTE ON FUNCTION can_view_quest_members(UUID) TO authenticated;

DROP POLICY IF EXISTS "qm_select" ON quest_members;
CREATE POLICY "qm_select"
  ON quest_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR can_view_quest_members(quest_id)
  );
