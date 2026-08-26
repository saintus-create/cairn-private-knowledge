# Primary-Law Expert Project Policy

## Purpose

Cairn’s **primary-law expert** is a named project whose answers are limited to approved, saved official legislative or judicial materials. It is not a general legal chatbot, a case-outcome predictor, or a commentary aggregator.

> The expert may explain what a saved provision says and cite its saved official source. It must identify missing, conflicting, or outdated evidence rather than supply outside assumptions.

## Source classes

| Priority | Source class | California Family Code expert treatment | Citation requirement |
|---|---|---|---|
| 1 | Current statutory text | California Legislative Information Family Code pages. | Code, division, part, chapter/article where available, section, official URL, snapshot timestamp, and source hash. |
| 1 | Procedural rules | California Rules of Court, especially Title Five: Family and Juvenile Rules. | Rule number, title, official PDF URL, extracted page/location, snapshot timestamp, and source hash. |
| 2 | Official bill and session material | California Legislative Information bill pages and official text/status records. | Bill identifier, session, official URL, version/status label, snapshot timestamp, and source hash. |
| 3 | User-supplied source map | The Family Code repository’s JSON and documentation output. | Mark as user-supplied reference; never silently substitute it for an official source when one is available. |
| Excluded by default | Commentary, law-firm summaries, crowd annotations, generated commentary | Not part of the expert’s evidence base unless a separate, visibly labeled source collection is added. | Never cited as statutory authority. |

## California Family Code expert manifest

| Field | Initial value |
|---|---|
| Project name | California Family Code expert |
| Project purpose | Source-bounded explanation and retrieval over official California Family Code materials, companion Title Five rules, and separately labeled official bill/session material. |
| Primary statutory root | `https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=FAM&tocTitle=+Family+Code+-+FAM` |
| Companion rules root | `https://courts.ca.gov/forms-rules/rules-court` → Title Five: Family and Juvenile Rules (Rules 5.1–5.906). |
| Repository seed map | `https://github.com/saintus-create/family-905324` (reference-map role only). |
| Verified repository hierarchy | 17 divisions, 74 parts, 184 chapters, and 1,420 sections represented in `tableofcontents.json`. |
| Default answer boundary | Saved project sources only; source type and snapshot time shown in citations. |

## Staged ingestion policy

The Family Code corpus should not be treated as a one-click, unobservable scrape. Cairn should retain a manifest, a resumable work queue, and source-level status so that the user can inspect exactly what is saved.

> **Acquisition rule:** Cairn must honor the current robots policy of the public California Legislative Information portal. Where the official **Downloadable Database** provides the needed material, it should be evaluated as the preferred acquisition channel before any page-by-page collection is offered.[2]

The official database inventory includes approximately gigabyte-scale biennial and daily archives. Those archives are not suitable for direct browser upload or autoscaled request handling. The production implementation therefore needs a bounded preparation worker that retrieves an approved archive, extracts only the Family Code subset, records the archive name and publication date, and hands Cairn a compact, inspectable source package.[3]

The official README identifies code and law-section table files, including large-object files paired with law-section records. The worker must first validate the selected archive’s declared schema and use that relationship to select `FAM` records; it must not infer statutory structure from secondary material or a page scrape.[4]

| Stage | Scope | Required result |
|---|---|---|
| 1. Source-map registration | Add the official Family Code root, Title Five rules, and the repository map as separate source records. | No answer may claim corpus coverage yet. |
| 2. Statute reconciliation | Use the repository map to enumerate expected official Family Code section paths, fetch allowed official pages, and retain source hashes and retrieval times. | Each saved section points to an official source URL. |
| 3. Rules ingestion | Import Title Five as a separate official PDF source with stable rule/page anchors. | Rules are never blended into statutory passages. |
| 4. Bill/session material | Add approved bill pages or status snapshots only when a session/version is named. | Citations label bill, session, and version/status. |
| 5. Refresh | Recheck only a user-approved source manifest and retain prior snapshots when text changes. | Cairn can say which snapshot it used and when it was retrieved. |

## Extensibility

Congress.gov and other official legislative portals are separate expert projects, not additional ambient knowledge. A U.S. federal expert should distinguish legislation, bill text, public laws/statutes, U.S. Code, and statute compilations because the official portal exposes them as different materials.[1]

## References

[1] [Congress.gov — official U.S. federal legislative information](https://www.congress.gov/)

[2] [California Legislative Information — official home and downloadable database link](https://leginfo.legislature.ca.gov/faces/home.xhtml)

[3] [California Legislative Information — official Downloadable Database index](https://downloads.leginfo.legislature.ca.gov/)

[4] [California Legislative Information — Downloadable Database README](https://downloads.leginfo.legislature.ca.gov/pubinfo_Readme.pdf)
