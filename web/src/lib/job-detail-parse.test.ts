import { describe, expect, it } from "vitest";

import { extractBulletLines, parseJobDescriptionSections } from "@/lib/job-detail-parse";

describe("job detail parsing", () => {
  it("extracts markdown and numbered bullet lines", () => {
    expect(
      extractBulletLines(
        [
          "Overview paragraph",
          "- Build candidate pipelines",
          "• Review applications",
          "* Coordinate interviews",
          "1. Maintain ATS records",
          "2) Report hiring metrics",
        ].join("\n"),
      ),
    ).toEqual([
      "Build candidate pipelines",
      "Review applications",
      "Coordinate interviews",
      "Maintain ATS records",
      "Report hiring metrics",
    ]);
  });

  it("keeps overview text separate from bullet sections", () => {
    const parsed = parseJobDescriptionSections(
      [
        "Join the hiring team and support rapid growth.",
        "",
        "- Source candidates",
        "- Screen applicants",
        "- Schedule interviews",
      ].join("\n"),
    );

    expect(parsed.overview).toBe("Join the hiring team and support rapid growth.");
    expect(parsed.responsibilities).toEqual([
      "Source candidates",
      "Screen applicants",
      "Schedule interviews",
    ]);
    expect(parsed.requirements).toEqual([]);
  });
});
