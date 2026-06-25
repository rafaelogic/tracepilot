import { describe, expect, it } from "vitest";
import { resolveWorkspaceView } from "./App";

describe("resolveWorkspaceView", () => {
  it("keeps the workspace in a stable loading state during initialization", () => {
    expect(resolveWorkspaceView(true, null)).toBe("loading");
  });

  it("uses the report layout as soon as a run is selected", () => {
    expect(resolveWorkspaceView(false, "run-1")).toBe("report");
    expect(resolveWorkspaceView(true, "run-1")).toBe("report");
  });

  it("uses the home layout when initialization finishes without a run", () => {
    expect(resolveWorkspaceView(false, null)).toBe("home");
  });
});
