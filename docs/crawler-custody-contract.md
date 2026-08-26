# Crawler-to-Cairn custody contract

## Principle

>An external crawler may discover and fetch. **Cairn owns the approved collection.**

The crawler is a transient worker, not a source of truth. A collection must remain searchable, citable, and inspectable after a Firecrawl, Exa, or other provider account is unavailable.

## Worker output contract

Every worker returns page candidates in a common shape:

| Field | Cairn requirement |
|---|---|
| `canonicalUrl` | Required; re-canonicalized and revalidated by Cairn. |
| `sourceUrl` | Required; retained for source-native citations. |
| `title` | Retained as worker metadata, not trusted as a citation by itself. |
| `text` or `markdown` | Normalized and checked for minimum readable content. |
| `fetchedAt` | Recorded with the snapshot. |
| `contentHash` | Recomputed by Cairn after normalization. |
| `sourceMetadata` | Optional; stored separately from evidence text. |

## Cairn custody steps

1. **Boundary gate:** confirm public address, approved host or connector scope, robots and source rules, and selected path constraints.
2. **Normalization:** preserve the original URL, clean the retrieved text, and retain declared section/version metadata where a structured connector provides it.
3. **Immutable snapshot:** compute a new content hash and store an immutable page snapshot before retrieval indexing.
4. **Evidence index:** create section-aware passages, heading paths, and citation anchors that point back to the original source.
5. **Progress record:** record worker, job ID, fetch time, page status, retry state, and any failure without discarding earlier good snapshots.
6. **Answer boundary:** retrieve only Cairn-stored passages, clearly labeling when evidence is insufficient, contradictory, historical, or superseded.

## Worker choice

| Worker | Use when | Cairn still controls |
|---|---|---|
| Native fetcher | Public HTML is stable and simple. | Scope, rate limit, snapshots, citations, and retries. |
| Sitemap/index adapter | A site publishes a machine-readable inventory. | The approved subset and durable page queue. |
| Structured connector | The source exposes statute, bill, archive, or database records. | Source hierarchy, version labels, and evidence snapshots. |
| Firecrawl or Exa | Rendering/discovery requires an external specialist worker. | Every persisted page, source boundary, collection identity, and answer. |

## Failure rule

A failed worker must never invalidate a completed collection. Cairn retains the last successful immutable snapshot and reports the failed refresh separately.
