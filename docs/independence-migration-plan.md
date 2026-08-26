# Cairn Independence Migration Plan

## Purpose

This plan describes a **reversible transition**, not an immediate switch-off. Cairn must not move its login, metadata, or private files until the replacement environment can prove that it preserves project isolation, evidence passages, source snapshots, citations, and original document custody.

## Target Shape

| Layer | Current role | Target replacement | Non-negotiable rule |
|---|---|---|---|
| Sign-in | Manus OAuth | Cairn-owned authentication, with Supabase Auth as the initial candidate | Users sign into Cairn, not Manus |
| Metadata | Managed MySQL | User-owned Postgres | Every record remains exportable and tied to its Cairn user/project |
| Original files | Manus private storage | Private object bucket | Store bytes outside the database; never make original documents public |
| App runtime | Manus-managed host | GitHub-controlled deployment on a user-selected host | Deployable with environment variables documented outside Manus |
| Optional model | Manus-proxied call | Provider adapter or user key | Retrieval and citations must work with no model enabled |

Supabase is a reasonable managed starting point because Auth issues JWTs and can participate in database row-level authorization, while private storage requires authenticated access or time-limited signed access rather than a public asset URL.[1] [2] It is not the only viable provider, and Cairn’s code should keep its interfaces portable.

## Migration Sequence

| Step | Work | Completion evidence | Rollback boundary |
|---|---|---|---|
| 1. Inventory | Export a schema map and row counts for projects, collections, pages, snapshots, passages, batches, and uploaded-document metadata. Record every storage key and file hash. | Counts and hashes stored in a dated migration manifest. | No live behavior changes. |
| 2. Provision | Create a new private database, private document bucket, and Cairn authentication project. Apply owner/project policies before importing private data. | A new empty environment passes policy checks with a non-owner test session denied. | Delete the empty target environment. |
| 3. Copy | Copy database records and original document bytes to the new store, retaining stable import identifiers and evidence text. | Per-table counts, per-file hashes, and sampled citations match the manifest. | Keep current data as source of truth; discard the target copy. |
| 4. Dual-read verification | Run read-only project searches against both environments. Compare status, cited passage IDs, titles, URLs, and excerpts for a fixed set of questions. | A written comparison report records all expected and unexpected differences. | Continue serving the current environment only. |
| 5. Identity transition | Create/match Cairn identities and map current owners deliberately. Do not infer identities from e-mail without owner confirmation. | Each user can sign in to Cairn and see only their own projects. | Re-enable existing identity path while mappings are retained. |
| 6. Cutover | Release a version configured for the independent services. Keep the old runtime read-only for a defined observation window. | New upload, website import, project retrieval, and citation tests pass against the independent environment. | Repoint the app to the old runtime while the old data remains read-only. |
| 7. Archive | Export a final backup and retain the prior environment only for the agreed retention window. | Owner receives an export and confirms the independent system is complete. | No deletion until the retention decision is explicit. |

## Data-Custody Rules

The migration must retain **raw uploaded bytes** in private object storage and only store metadata, object key, type, size, hash, and project ownership in the database. Private object access must be protected by a user/session policy or a short-lived server-created URL; public URLs are not acceptable for personal documents.[2]

Website citations should preserve their original canonical public URL and source snapshot history. Private-document citations should remain internal to Cairn and resolve through an authenticated document route rather than revealing a storage-provider URL. The migration must keep `projectId` attached to every collection so an answer cannot cross a project boundary accidentally.

## Explicit Non-Goals

The migration does not require a paid model provider, an embedding vendor, Firecrawl, or a background crawler. Deterministic text retrieval remains Cairn’s baseline. Any future model, crawler, or search provider must be an optional adapter that cannot become the source of truth.

## References

[1] [Supabase Auth documentation](https://supabase.com/docs/guides/auth)

[2] [Supabase private storage bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals)
