import { afterEach, describe, expect, it, vi } from "vitest";
import { familyCodeOfficialUrls } from "./knowledgeDb";

const officialOne = "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM&division=1.&part=1.";
const officialTwo = "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=FAM&division=2.&part=1.";

describe("Family Code primary-law manifest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps only unique official California Family Code display routes", async () => {
    const sourceMap = {
      california_family_code_structure: [{
        parts: [{
          chapters: [{
            sections: [
              { section_number_citation: officialTwo },
              { section_number_citation: "https://example.com/family" },
              { section_number_citation: officialOne },
              { section_number_citation: officialOne },
            ],
          }],
        }],
      }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(sourceMap))));

    await expect(familyCodeOfficialUrls()).resolves.toEqual([officialOne, officialTwo]);
  });

  it("rejects an unparseable source map rather than importing unknown routes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));

    await expect(familyCodeOfficialUrls()).rejects.toThrow("not valid JSON");
  });
});
