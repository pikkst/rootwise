# Database

## `migrations/`
SQL migration scripts to run in Supabase SQL editor in order when setting up or upgrading the database schema.

| File | Description |
|---|---|
| supabase-migration-run-this.sql | Core schema — run first |
| supabase-migration-stripe.sql | Stripe subscription tables |
| supabase-migration-platform-admins.sql | Admin role support |
| supabase-migration-profile-language.sql | Language preference on profiles |
| supabase-migration-locations.sql | User location data |
| supabase-migration-user-reports.sql | Content reporting system |
| supabase-migration-ai-memory.sql | AI Nexus conversation memory |
| supabase-migration-notifications.sql | In-app notifications |
| supabase-migration-quest-translations.sql | Multilingual quest content |
| supabase-migration-video-calls.sql | Quest video call support |
| supabase-migration-public-views-hardening.sql | Base tables private for anon; safe public read via views |

## `scripts/`
One-off utility scripts — not part of the standard migration sequence.

| File | Description |
|---|---|
| supabase-schema.sql | Full schema snapshot |
| supabase-admin-add-user.sql | Manually promote a user to admin |
| supabase-fix-quest-status.sql | Data repair script for quest statuses |
