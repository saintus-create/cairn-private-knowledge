# Cairn Independence Boundary

## Current State

Cairn’s product code and private GitHub backup are owned as source code, but the present runtime uses Manus OAuth for identity, Manus-managed MySQL for metadata, Manus storage for original private files, and a Manus-proxied optional model call. It is therefore **not yet an independently operated application**.

## Target Ownership Model

| Concern | Cairn-owned replacement | Required property |
|---|---|---|
| Identity | User-selected provider, with Supabase Auth as the default candidate | Cairn sign-in rather than Manus sign-in |
| Evidence metadata | User-owned Postgres database | Project, collection, passage, citation, and snapshot records remain exportable |
| Original documents | Private object storage bucket | Raw bytes remain out of the database and inaccessible by public URL |
| Runtime | GitHub-controlled deployment on a user-selected host | The app can run without Manus services |
| Model synthesis | Optional bring-your-own-key adapter | Deterministic evidence retrieval continues with no model account or credit use |

Supabase is a practical first candidate because it offers Auth backed by JWTs and Postgres authorization policies, while private storage buckets require authenticated or time-limited access rather than exposing public document URLs.[1][2] The managed database and object storage must be backed up independently: database backups do not include objects stored through the Storage API.[3]

## Migration Rules

1. **Do not break private custody.** First copy database records, source snapshots, storage objects, and their metadata into the replacement environment; verify counts and hashes before retiring any existing path.
2. **Do not mix identities.** Add the Cairn-owned identity layer before switching browser sessions, and map each existing owner to a new Cairn account deliberately.
3. **Do not make model access mandatory.** The existing deterministic retrieval path remains the default; optional synthesis is an adapter, not part of ingestion or citation integrity.
4. **Do not block current product work.** The new project boundary remains implemented in application code, with the independence migration treated as a planned infrastructure seam rather than a hidden dependency.

## References

[1] [Supabase Auth documentation](https://supabase.com/docs/guides/auth)

[2] [Supabase Storage bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals)

[3] [Supabase database backups and Storage limitation](https://supabase.com/docs/guides/database/overview)
