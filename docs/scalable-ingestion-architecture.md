# Cairn Scalable Ingestion Architecture

Cairn is intentionally **not** an unconstrained crawler. Its durable value is inspectable, source-bounded evidence. The current system handles a user-approved website collection or an owner-prepared official corpus; a larger workflow must retain that approval boundary, private-file custody, immutable source artifacts, and explicit scope/currency statements.

## Current Boundaries

| Area | Current enforced boundary | Operational meaning |
|---|---:|---|
| Website collection selection | 50 pages | A normal website import is a reviewed, finite collection—not a site-wide crawl. |
| Website discovery preview | 180 links | Discovery is intentionally capped before a user selects pages. |
| Fetched public page | 1.5 MB | Prevents a single page from exhausting request memory or becoming an opaque bulk dump. |
| Public fetch timeout | 12 seconds | Slow or unavailable pages become an import outcome, not a stalled task. |
| Redirects | Fewer than 4 hops | Avoids silent source changes or open-ended redirects. |
| Private document raw bytes | 20 MB | Documents are held privately in object storage; database rows contain metadata and extracted evidence only. |
| Initial official Family Code writes | 150 page rows, then 100 snapshots/passages per batch | Large statutory records are persisted in bounded batches with archive provenance. |
| Current evidence retrieval | 80 candidate passages, at most 4 citations | Answers stay concise and inspectable rather than surfacing an unbounded context window. |

> These limits are **product boundaries**, not claims that every source in the world is importable today. A source that exceeds them needs a prepared and reviewed path before it can support answers.

## Viable Paths for Larger Corpora

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---|
| **Prepared official artifact, then one bounded admission** | Best for statutes, rules, exports, and other sources with a downloadable authoritative snapshot. It requires selecting a release and preparing it outside normal app requests, but produces the strongest checksum, version, and archive trail. | Uses existing storage and database capacity; no recurring model use. | Moderate; the preparation script runs deliberately on a user-controlled machine or a suitable bounded environment. |
| **Reviewed small website collection** | Easiest current path for a focused official website section. It preserves user selection but remains limited to 50 pages and is not appropriate for thousands of pages. | No added infrastructure. | Low. |
| **Future durable import queue** | Supports a large, approved URL manifest through small leased batches and resumable progress. It requires job tables, an operator-facing review state, and a bounded scheduled trigger; it must not become an unreviewed crawler. | Depends on hosting and execution frequency. | Higher; not implemented yet. |

For official primary law, Cairn’s selected pattern is the first: acquire a permitted authoritative release, verify checksum and source identity, extract only the approved subject corpus in a bounded preparation environment, store the immutable selected extract privately, then admit it through a transaction that preserves pages, snapshots, and citations. The Family Code archive and Title Five PDF use this pattern.[1] [2]

## Required Contract for Any Large Official Corpus

Every preparation must produce a reviewable manifest before Cairn accepts evidence. The manifest must identify the publisher, source URL, acquisition time, original-file hash and bytes, selected-record count, extract hash, stable record keys, text hashes, scope rule, and any effective-date or version fields available from the source. Raw original bytes and the selected extract belong in private object storage; the database stores references and searchable derived text.

For subsequent releases, the importer compares stable record keys and text hashes. Unchanged records remain intact; changed records receive a new immutable snapshot; new records are added; and source records no longer present are retained as historical rather than silently deleted or used for current answers. This is the behavior implemented for later Family Code archive updates.

## Website Queue Prerequisites

A future high-volume website path must begin with a user-approved URL manifest—not a domain-wide command. A manifest row must contain the collection ID, original and normalized URL, source hostname, include/exclude rule match, user approval time, source-proposal origin, and the import batch ID that admitted it. It must be immutable once approved; a later refresh creates a new batch rather than editing the original scope.

| Queue state | Meaning | Required transition rule |
|---|---|---|
| `proposed` | Discovered but not source evidence. | User approval is required before it can enter the manifest. |
| `approved` | In a finite collection manifest, awaiting work. | A worker may lease it only after URL, hostname, and robots checks are repeated. |
| `leased` | One bounded run has temporary ownership. | Lease includes a worker ID, acquired time, expiry time, and attempt count; an expired lease returns to `approved`. |
| `fetched` | Bytes and response metadata were obtained within current fetch caps. | Must pass redirect, MIME, size, and quality checks before snapshot creation. |
| `indexed` | Versioned snapshot and passages were committed. | Stores content hash, page ID, and completed-at time. |
| `skipped` | Source was unchanged or unsuitable. | Stores a deterministic reason and previous content hash when applicable. |
| `failed` | A bounded attempt could not finish. | Stores error class, safe message, retry count, and next eligible time; no automatic infinite retry. |

Each bounded run should validate the same public-URL, hostname, redirect, robots, timeout, size, and source-quality rules used today. It may claim a small fixed number of approved rows, persist each outcome independently, and stop before the environment’s request or memory budget is exhausted. A worker must never convert a `proposed` URL directly into evidence.

For multiple private documents, the corresponding admission unit is a **document set**: each selected file receives its own private object key, byte hash, MIME validation, extraction status, source page, and snapshot. The set has an explicit user review step listing file names, byte sizes, extraction readability, and intended project before any file is indexed. A failed file is visible as failed without blocking safe files; a duplicate content hash is linked to the existing document rather than silently re-indexed. Current Cairn supports one private document admission at a time, so this document-set queue is future work rather than an enabled feature.

## Statutory Corpus Contract Across Releases

Official statutory preparation must retain hierarchy and legislative-change context as first-class data, not as an incidental paragraph of extracted text. The normalized record contract below is required for every selected section.

| Field group | Required values | Release behavior |
|---|---|---|
| Identity | Jurisdiction, code, normalized section number, stable official record key, canonical official URL | Stable key determines whether a record is unchanged, changed, added, or retired. |
| Hierarchy | Division, title, part, chapter, article, and heading path when supplied by the authority | Stored with each page and snapshot; a release may update hierarchy without erasing the prior snapshot’s path. |
| Text and citation | Canonical text, text SHA-256, citation title, official source URL, source archive/file hash, acquisition time | Unchanged text reuses the current record; changed text creates a new snapshot and new passage set. |
| Amendment and currency | Statute session/year, chapter, section, operative/effective date, inoperative date if supplied, official history, and release identity | Preserved with both the current record and immutable snapshot. A changed or retired record never loses its prior amendment context. |
| Status | Active, operative/inoperative variant where explicitly reported, or retired after an absent later release | Retired records remain inspectable historical records and are excluded from current-answer retrieval. |

The applied Family Code delta rules are the reference behavior: compare prior and next records by official key and text hash; add new records; make a new versioned snapshot only for changed records; keep unchanged records; and label records absent from the later official archive as retired rather than deleting them. Each snapshot carries the source archive relationship and citation metadata available for that release. This makes an answer’s current source and any later historical inspection traceable to a concrete official artifact.

External discovery or extraction services can assist only as a **proposal producer**. They cannot become Cairn’s source of record, bypass a site’s robots policy, or create answer evidence before the user approves the returned source boundary. A Firecrawl-style integration therefore remains optional and unimplemented; any future integration must feed the reviewed manifest and custody contract rather than write directly to evidence tables.

## Explicit Non-Goals Until Further Work

The present application has no automatic recurring corpus update, no unlimited website crawler, no sitemap queue, and no background worker that runs outside an active bounded request. It also does not treat an official portal’s public pages as crawlable merely because the portal is useful; California Legislative Information’s public portal remains excluded from automated crawling, while its official Downloadable Database is the approved Family Code acquisition route.[1]

Any recurring or high-volume future queue requires a separate operational decision: its trigger frequency, hard runtime and memory budget, execution environment, source-specific permission, and owner review state must be selected before code is enabled. Cairn must continue to return **insufficient evidence** instead of substituting unsaved web material or model inference.

## References

[1] [California Legislative Information — Downloadable Database](https://downloads.leginfo.legislature.ca.gov/)

[2] [California Courts — Rules of Court](https://courts.ca.gov/forms-rules/rules-court)
