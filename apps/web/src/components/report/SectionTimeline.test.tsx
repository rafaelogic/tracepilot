import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionTimeline } from "./SectionTimeline";

describe("SectionTimeline", () => {
  it("renders section screenshots with a highlight overlay when needed", () => {
    const html = renderToStaticMarkup(
      <SectionTimeline
        resources={[]}
        sections={[{
          id: "section-1",
          label: "Hero",
          selector: "main > section",
          elementHtml: "<section>Hero</section>",
          screenshot: {
            dataUrl: "data:image/png;base64,abc",
            clip: { x: 0, y: 100, width: 1200, height: 700 },
            target: { x: 0, y: 40, width: 1200, height: 320 },
            highlight: true
          },
          top: 100,
          height: 320,
          firstDetectedMs: 10,
          firstVisibleMs: 20,
          contentStableMs: 30,
          renderCompleteMs: 40,
          layoutShiftScore: 0,
          blockingResourceCount: 0
        }]}
      />
    );

    expect(html).toContain("Section screenshot");
    expect(html).toContain("data:image/png;base64,abc");
    expect(html).toContain("section-screenshot-highlight");
  });
});
