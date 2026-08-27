import { describe, expect, it } from "vitest";
import { sourceArchiveStatus } from "./sourceArchiveStatus";

describe("sourceArchiveStatus", () => {
  it("keeps a prepared official source clearly non-evidentiary", () => {
    expect(sourceArchiveStatus(null)).toEqual({
      label: "Official source prepared",
      detail: "No approved official archive has been imported yet. Cairn will not answer from this source until it has evidence.",
      acquiredDate: null,
      shortSha256: null,
    });
  });

  it("presents the durable provenance fields of an active official archive", () => {
    expect(sourceArchiveStatus({
      fileName: "pubinfo_2025.zip",
      sourceUrl: "https://downloads.example/pubinfo_2025.zip",
      acquiredAt: new Date("2026-08-25T00:00:00.000Z"),
      recordCount: 1636,
      archiveSha256: "a3efc8049f45406a4cc96871e1a23c3af8ead6bf81847947bdbf57d136c8215e",
    })).toMatchObject({
      label: "Official archive active",
      detail: "1,636 active records",
      acquiredDate: "2026-08-25",
      shortSha256: "a3efc8049f45…",
    });
  });
});
