# California Family Code Official Archive Extraction Contract

## Purpose

This contract governs the first primary-text corpus for Cairn’s **California Family Code expert**. It implements the user’s decision that the expert must answer only from verified official statutory text, not from the existing GitHub repository snapshot, page scraping, or commentary.

## Approved input

| Field | Selected value |
|---|---|
| Publisher | California Legislative Information / Office of Legislative Counsel |
| Archive | `pubinfo_2025.zip` |
| Official URL | `https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip` |
| Observed response date | 2026-08-26 UTC |
| Last modified | 2026-08-24 04:25:48 UTC |
| ETag | `48a3f3a9-659c361688b00` |
| Reported size | 1,218,704,297 bytes |
| Range support | Supported |

The archive is selected because the official California Legislative Information site links its Downloadable Database from its home page. The public portal’s `robots.txt` disallows automated crawling, so Cairn must not substitute portal pages for this archive.[1] [2]

## Extraction boundary

The preparation job may inspect the archive’s declared code and law-section table definitions. It must select only records associated with the **Family Code (`FAM`)**, retain the archive identity and retrieval time, and create one inspectable record for each code section. The job must not use the user’s GitHub repository as statutory evidence; it may use it only to compare expected source-map structure.

Each prepared section record must contain the official archive identity, archive checksum, code identifier, available hierarchy fields, section identifier, normalized statutory text, source-row identifiers where available, preparation timestamp, and a text hash. Cairn must retain the raw archive or an immutable canonical extract in private object storage before admitting any derived passages as answer evidence.

## Admissibility gate

> No Family Code answer may be presented as evidence-backed until the extracted official section records are stored, hashed, attributed to this archive, indexed, and individually retrievable through a citation.

The initial import must disclose its archive version and scope. Later refreshes must preserve prior snapshots and compare section hashes, rather than replacing the existing corpus invisibly.

## Runtime boundary

The 1.2 GB archive must be acquired and prepared in a bounded worker environment, not through a browser upload or a normal autoscaled request. The current sandbox has sufficient short-term disk capacity for a one-time inspection, but the portable implementation should run the same deterministic extractor on a user-owned local machine or appropriately provisioned worker before it uploads compact selected records to Cairn-owned storage.

## Initial snapshot result

The selected official `pubinfo_2025.zip` archive was acquired, SHA-256 verified as `a3efc8049f45406a4cc96871e1a23c3af8ead6bf81847947bdbf57d136c8215e`, and inspected without portal crawling. The extractor admitted **1,636 active official `FAM` records**, representing **1,629 distinct section numbers** plus **7 overlapping operative/inoperative record variants** that were retained separately rather than silently discarded. Cairn stored 1,636 section pages and 4,629 derived passages under the official archive identity. An exact Section 5602 retrieval returned that section first with the archive’s native record anchor.

## References

[1] [California Legislative Information home page](https://leginfo.legislature.ca.gov/faces/home.xhtml)

[2] [California Legislative Information Downloadable Database](https://downloads.leginfo.legislature.ca.gov/)
