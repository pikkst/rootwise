-- Direct 1:1 inbox messaging (mailbox style)
-- Supports: send, reply, per-user soft delete, read state

BEGIN;

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  read BOOLEAN NOT NULL DEFAULT false,
  sender_deleted BOOLEAN NOT NULL DEFAULT false,
  recipient_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dm_sender_recipient_diff CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_sender_created ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_created ON public.direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread ON public.direct_messages(recipient_id, read) WHERE read = false;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'direct_messages' AND policyname = 'dm_select_own_visible'
  ) THEN
    CREATE POLICY dm_select_own_visible
      ON public.direct_messages
      FOR SELECT
      USING (
        (auth.uid() = sender_id AND sender_deleted = false)
        OR
        (auth.uid() = recipient_id AND recipient_deleted = false)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'direct_messages' AND policyname = 'dm_insert_sender_only'
  ) THEN
    CREATE POLICY dm_insert_sender_only
      ON public.direct_messages
      FOR INSERT
      WITH CHECK (
        auth.uid() = sender_id
        AND auth.uid() <> recipient_id
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'direct_messages' AND policyname = 'dm_update_participant'
  ) THEN
    CREATE POLICY dm_update_participant
      ON public.direct_messages
      FOR UPDATE
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id)
      WITH CHECK (
        (
          auth.uid() = sender_id
          AND sender_id = auth.uid()
        )
        OR
        (
          auth.uid() = recipient_id
          AND recipient_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END$$;

COMMIT;
