import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { sectionObserverScript } from "./section-observer";

describe("sectionObserverScript", () => {
  it("installs safely before the document root exists", () => {
    const listeners = new Map<string, () => void>();
    const windowObject = {
      addEventListener: vi.fn((event: string, callback: () => void) => listeners.set(event, callback)),
      clearInterval: vi.fn(),
      innerWidth: 1440,
      scrollY: 0,
      setInterval: vi.fn(() => 1)
    };

    expect(() => vm.runInNewContext(sectionObserverScript, {
      CSS: { escape: (value: string) => value },
      IntersectionObserver: class { observe() {} },
      Map,
      MutationObserver: class { observe(target: unknown) { if (!target) throw new TypeError("target must be a Node"); } },
      Node: { ELEMENT_NODE: 1 },
      PerformanceObserver: class { observe() {} },
      Set,
      document: { body: null, documentElement: null, querySelectorAll: () => [] },
      performance: { now: () => 0 },
      window: windowObject
    })).not.toThrow();

    expect(windowObject).toHaveProperty("__sectionTimeline");
    expect(listeners.has("DOMContentLoaded")).toBe(true);
  });
});
