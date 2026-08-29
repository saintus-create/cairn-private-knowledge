# Cairn independence cutover

Cairn is being moved from the original Manus-oriented runtime to a user-owned stack. The target is:

- Supabase Auth for identity
- Supabase Postgres for application and knowledge data
- Supabase private Storage for uploaded/source artifacts
- Cairn's evidence/retrieval layer as the source of truth
- Provider-neutral AI, with OpenRouter as the initial pay-per-use provider and Ollama as a future local option
- Cairn conversation state persisted independently of the model provider

## Current state

The application remains temporarily hybrid so existing data and routes are not destroyed during migration. Supabase authentication and server-side persistence primitives are present, while the legacy MySQL/Drizzle data layer remains the active knowledge store until a verified data migration is performed.

The migration schema is in `supabase/migrations/0001_cairn_independence.sql`.

## Cutover sequence

1. Create/configure the Supabase project and enable the desired authentication provider.
2. Apply `supabase/migrations/0001_cairn_independence.sql`.
3. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CAIRN_OWNER_EMAIL` in the deployment environment. Never expose the service-role key to the browser.
4. Sign in through Supabase and confirm the resulting `auth.users.id` is represented in `public.users`.
5. Export the current MySQL database and migrate rows into the matching Supabase tables while preserving numeric IDs. Map the legacy user row to `auth_user_id`.
6. Verify row counts, hashes, collection/page/passages relationships, snapshots, and uploaded-document metadata before changing the application database adapter.
7. Switch Drizzle from MySQL to PostgreSQL (or replace it with the Supabase data adapter) only after the migration verification passes.
8. Move source/archive objects to the `cairn-private` bucket and verify signed access.
9. Make Supabase authentication authoritative in the tRPC context; remove the Manus OAuth fallback.
10. Remove Manus SDK/runtime/debug tooling and the `mysql2` dependency only after production smoke tests pass.
11. Enable persistent conversation creation/message storage in the UI.
12. Run the complete test suite and a production build before deleting any legacy infrastructure.

## Safety rule

Do not delete the legacy database, Manus OAuth code, or old storage until the migrated Supabase dataset has been independently verified. Independence is achieved by cutover, not by deleting dependencies prematurely.
