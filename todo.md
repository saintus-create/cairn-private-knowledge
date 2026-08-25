# Project TODO

- [x] Establish a secure collection, source-page, passage, import-batch, and expert-profile data model with user ownership boundaries.
- [x] Add server-side public-URL validation, blocked-address checks, robots-aware fetch policy, redirect limits, and content-size limits for website ingestion.
- [x] Build a black-on-white Cargo-inspired editorial application shell with strict grid alignment, type-led hierarchy, responsive navigation, and restrained motion.
- [x] Build the website collection onboarding flow for a seed URL, expert name, scope, audience, tone, answer mode, include rules, exclude rules, and selected page limit.
- [x] Build the website-scope preview with discovered URLs, estimated page count, selection controls, and include/exclude path visibility.
- [x] Implement approved-page ingestion into clean, versioned text snapshots preserving URL, title, headings, import time, content hash, source status, source metadata, and immutable history.
- [x] Implement heading-and-passage chunking with durable citation anchors, heading paths, and excerpts that open the original public page.
- [x] Implement manual refresh and resumable import batches that skip unchanged content based on hashes and preserve batch progress.
- [x] Implement collection-restricted retrieval and evidence-first article entries with explicit insufficient-evidence results.
- [x] Implement source passages, claim-adjacent citations, reference views, source-status indicators, and related entries in the shared editorial system.
- [x] Ensure the expert profile influences scope and tone only, never adds unsupported facts or overrides source evidence.
- [x] Add a model-optional answer layer that remains disabled by default so routine retrieval and testing do not consume model credits.
- [x] Add database migrations, typed procedures, server and client tests, and meaningful empty, loading, error, and success states.
- [x] Verify desktop and mobile layouts, run static checks and tests, and visually inspect all core screens before final delivery.
