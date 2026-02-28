-- ============================================================
-- Rootwise — User-Created Quests
-- Allows platform users to publish their own quest ideas
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. ADD is_user_created FLAG TO QUESTS
-- ============================================================
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS is_user_created BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quests_user_created ON quests(is_user_created);

-- ============================================================
-- 2. RPC: Count how many custom quests a user has created
--    Used by client to enforce free-plan limit (max 2)
-- ============================================================
CREATE OR REPLACE FUNCTION count_user_created_quests()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM quests
  WHERE created_by = auth.uid()
    AND is_user_created = TRUE;
$$;

REVOKE ALL ON FUNCTION count_user_created_quests() FROM public;
GRANT EXECUTE ON FUNCTION count_user_created_quests() TO authenticated;

-- ============================================================
-- 3. ENSURE RLS ALLOWS AUTHENTICATED USERS TO INSERT QUESTS
--    (skip if your quests table already has insert policy)
-- ============================================================
-- ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to create a quest
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quests' AND policyname = 'quests_insert_authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "quests_insert_authenticated"
        ON quests FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = created_by);
    $policy$;
  END IF;
END;
$$;

-- Users can update their own user-created quests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quests' AND policyname = 'quests_update_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "quests_update_own"
        ON quests FOR UPDATE
        TO authenticated
        USING (auth.uid() = created_by AND is_user_created = TRUE);
    $policy$;
  END IF;
END;
$$;

-- Users can delete their own user-created quests (if not yet joined by others)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quests' AND policyname = 'quests_delete_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "quests_delete_own"
        ON quests FOR DELETE
        TO authenticated
        USING (
          auth.uid() = created_by
          AND is_user_created = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM quest_members
            WHERE quest_id = quests.id
              AND user_id != auth.uid()
          )
        );
    $policy$;
  END IF;
END;
$$;

-- ============================================================
-- Done!
-- Free users: up to 2 custom quests (enforced client-side via
--             count_user_created_quests() RPC)
-- Pro/Org users: unlimited
-- ============================================================
