import { describe, expect, it } from "vitest";
import { buildPageStructureFindings } from "./pageStructureToolService";

describe("buildPageStructureFindings", () => {
  it("flags multiple H1s, skipped heading levels, and split H1 content", () => {
    const findings = buildPageStructureFindings({
      url: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      title: "Example property search page",
      metaDescription: "Browse French property listings, village homes, chateaux, and buying guides with local context.",
      canonical: "https://example.com",
      headings: [
        { level: 1, text: "French", selector: "main > h1:nth-of-type(1)" },
        { level: 1, text: "Properties for sale", selector: "main > h1:nth-of-type(2)" },
        { level: 3, text: "Newest listings", selector: "main > h3" }
      ],
      h1Contexts: [
        {
          text: "French",
          selector: "main > h1:nth-of-type(1)",
          parentText: "French properties for sale in Nouvelle-Aquitaine",
          nextText: "properties for sale in Nouvelle-Aquitaine"
        },
        {
          text: "Properties for sale",
          selector: "main > h1:nth-of-type(2)",
          parentText: "Properties for sale",
          nextText: ""
        }
      ]
    });

    expect(findings.map((finding) => finding.id)).toEqual([
      "multiple-h1",
      "heading-level-skip",
      "h1-content-split"
    ]);
    expect(findings.find((finding) => finding.id === "multiple-h1")?.impact).toBe("failed");
  });

  it("keeps a clean heading outline free of findings", () => {
    const findings = buildPageStructureFindings({
      url: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      title: "French properties for sale in Normandy",
      metaDescription: "Browse curated French properties for sale in Normandy with region guides and buying advice.",
      canonical: "https://example.com/properties",
      headings: [
        { level: 1, text: "French properties for sale in Normandy", selector: "main > h1" },
        { level: 2, text: "Featured homes", selector: "main > section:nth-of-type(1) > h2" },
        { level: 3, text: "Village houses", selector: "main > section:nth-of-type(1) > h3" }
      ],
      h1Contexts: [
        {
          text: "French properties for sale in Normandy",
          selector: "main > h1",
          parentText: "French properties for sale in Normandy",
          nextText: "Featured homes"
        }
      ]
    });

    expect(findings).toEqual([]);
  });
});
