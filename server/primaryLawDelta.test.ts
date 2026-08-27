import { describe, expect, it } from "vitest";
import { compareOfficialRecordSnapshots, planOfficialArchiveDelta } from "./primaryLawDelta";

describe("official primary-law snapshot comparison", () => {
  it("separates added, changed, unchanged, and retired official records by stable key and text hash", () => {
    const result = compareOfficialRecordSnapshots(
      [
        { recordKey: "FAM1", textSha256: "old-1" },
        { recordKey: "FAM2", textSha256: "same-2" },
        { recordKey: "FAM3", textSha256: "retired-3" },
      ],
      [
        { recordKey: "FAM1", textSha256: "new-1" },
        { recordKey: "FAM2", textSha256: "same-2" },
        { recordKey: "FAM4", textSha256: "added-4" },
      ],
    );

    expect(result.changed.map((record) => record.recordKey)).toEqual(["FAM1"]);
    expect(result.unchanged.map((record) => record.recordKey)).toEqual(["FAM2"]);
    expect(result.added.map((record) => record.recordKey)).toEqual(["FAM4"]);
    expect(result.retired.map((record) => record.recordKey)).toEqual(["FAM3"]);
  });

  it("rejects a malformed archive that repeats an official record key", () => {
    expect(() => compareOfficialRecordSnapshots([], [{ recordKey: "FAM1", textSha256: "a" }, { recordKey: "FAM1", textSha256: "b" }])).toThrow("Next archive repeats FAM1.");
  });

  it("plans only new and changed records for current-evidence replacement while retaining missing records as retired history", () => {
    const plan = planOfficialArchiveDelta(
      [{ recordKey: "FAM1", textSha256: "old" }, { recordKey: "FAM2", textSha256: "same" }, { recordKey: "FAM3", textSha256: "gone" }],
      [{ recordKey: "FAM1", textSha256: "new" }, { recordKey: "FAM2", textSha256: "same" }, { recordKey: "FAM4", textSha256: "added" }],
    );

    expect(plan.applyCount).toBe(2);
    expect(plan.retainedCount).toBe(1);
    expect(plan.retiredCount).toBe(1);
    expect(plan.retired.map((record) => record.recordKey)).toEqual(["FAM3"]);
  });
});
