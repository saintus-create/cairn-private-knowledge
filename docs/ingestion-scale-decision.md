# Large-collection ingestion decision

## Current decision

Cairn should support **structured source connectors** and a **generic website connector** under one durable collection model. Statutes are one connector profile, not the product boundary.

Firecrawl is appropriate as an **optional worker** for JavaScript-heavy pages, URL mapping, asynchronous batch scraping, and web-hosted document extraction. It is not the system of record. Cairn must retain the approved URL set, source-policy checks, original URL, fetched content hash, immutable snapshots, citations, import status, and user-visible progress in its own database.

## Why Firecrawl is not the foundation

Firecrawl Cloud has plan-based credit, request-rate, and browser-concurrency limits. Its scrape documentation identifies one credit for a basic scrape and additional credit use for some options and PDF pages. Those constraints conflict with Cairn's goal of avoiding surprise credit traps for thousand-page collections. Its self-hosted offering requires operating upgrades, secrets, storage, monitoring, recovery, and production security; the baseline does not include durable storage or production authentication.

Its source code is licensed under AGPL-3.0, so shipping or modifying it inside Cairn would require a separate license/compliance review. A hosted API integration or separately operated service should remain replaceable behind Cairn's own ingestion-worker interface.

## Recommended architecture

1. **Collection planner:** discovers a sitemap, index, or connector-specific hierarchy and presents a bounded, inspectable import plan.
2. **Durable import queue:** stores page-level jobs, host rate limits, retry policy, checkpoint state, and content hashes independently of the browser session.
3. **Worker adapters:** native fetcher as the default; Firecrawl as an opt-in adapter for difficult JavaScript-heavy targets; structured statute/bill/PDF adapters where sources offer stable records.
4. **Canonical evidence store:** retains original source URL or upload key, normalized text, section hierarchy, version/date information, snapshots, and citations regardless of worker.
5. **Search and retrieval index:** supports collection-scoped searching over large corpora while returning explicit source and version citations.

## Sources

- [Firecrawl Scrape documentation](https://docs.firecrawl.dev/features/scrape)
- [Firecrawl Rate Limits documentation](https://docs.firecrawl.dev/rate-limits)
- [Firecrawl Self-hosting documentation](https://docs.firecrawl.dev/contributing/self-host)
- [Firecrawl repository and licensing](https://github.com/firecrawl/firecrawl)
