# Family Code Repository Assessment

## Candidate Repository

The user’s most recently updated Family Code repository is [`saintus-create/family-905324`](https://github.com/saintus-create/family-905324). It contains a Family Code documentation structure, generated division and part pages, a California legislation updater, and related legal-documentation materials.

## Initial Findings

| Area | Repository evidence | Cairn treatment |
|---|---|---|
| Family Code structure | `tableofcontents.json` is used to generate division/part documentation pages. | Useful as a source map, but not authoritative text by itself. |
| Code text | The generator emits Family Code division, part, chapter, section, and subsection content into documentation pages. | Re-ingest from the official California Legislative Information portal, retaining the portal URL and snapshot date. |
| Bills | `scripts/update_california_legislation.py` identifies California Legislative Information Bill Search as its publisher/source and preserves official bill URLs plus retrieval time. | A useful pattern for project metadata and version-aware bill sources. |
| Rules and related documents | The repository has Rules of Court and other legal-documentation material. | Keep each official corpus as a named source within the same Family Code expert project; do not blend it with commentary. |

The repository’s `tableofcontents.json` represents **17 divisions, 74 parts, 184 chapters, and 1,420 sections**. Its sample entries retain section and subsection text with California Legislative Information URLs, which makes it a valuable enumeration and reconciliation map even though Cairn should refresh statutory text from the official portal before treating it as statutory evidence.

## Official Source Check

The California Legislative Information Family Code table-of-contents route resolves as the official **“California Codes: Codes Tree — Family Code — FAM”** page. The browser did not expose usable page markup or a screenshot, so section-link extraction needs a separate HTTP/HTML acquisition method before Cairn treats the route as an import manifest.[1]

The California Legislative Information home page links to an official **Downloadable Database** at `downloads.leginfo.legislature.ca.gov`. The same page states that information described in Government Code section 10248 and made available there is in the public domain, and points to the legacy `leginfo.ca.gov` archive for measures before 1999. This is the preferred channel to investigate for code or bill bulk data because the public portal’s current `robots.txt` disallows automated crawling of its pages.[4]

The official download index exposes biennial archives through `pubinfo_2025.zip` (about 1.1 GB), smaller dated incremental archives, and daily files that are also approximately 1.0 GB. The directory is therefore an official acquisition candidate, but not a file that should be pulled into Cairn’s autoscaled runtime or browser workflow wholesale. A Family Code importer should use a separately provisioned, bounded preparation job to inspect the database format, extract only the relevant official code records, preserve the archive date/version, and then upload the selected text and metadata into Cairn-owned storage.[5]

The California Judicial Branch Rules of Court index is a usable official companion source. It lists **Title Five: Family and Juvenile Rules (Rules 5.1–5.906)** as a separately downloadable official PDF, so the Family Code expert should keep that title as its own named source rather than merging it into statutory text.[2]

Congress.gov identifies itself as the official U.S. federal legislative-information website and exposes distinct legislation, bill-text, Public Laws/Statutes, U.S. Code, and statute-compilation routes. A future federal expert should retain these as distinct source types and never replace statute text with CRS reports or other explanatory material by default.[3]

## Design Constraint

> The repository is a valuable map and prepared corpus, but Cairn should cite and snapshot the official primary source where it is available. Repository content can be imported as a separately labeled, user-supplied reference—not silently substituted for the official statute.

## References

[1] [California Legislative Information — Family Code table of contents](https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=FAM&tocTitle=+Family+Code+-+FAM)

[2] [California Rules of Court — Judicial Branch of California](https://courts.ca.gov/forms-rules/rules-court)

[3] [Congress.gov — official U.S. federal legislative information](https://www.congress.gov/)

[4] [California Legislative Information — home page](https://leginfo.legislature.ca.gov/faces/home.xhtml)

[5] [California Legislative Information — official Downloadable Database index](https://downloads.leginfo.legislature.ca.gov/)
