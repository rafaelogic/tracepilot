import { describe, expect, it } from "vitest";
import { resolveAuditNetwork } from "./network-target";

describe("resolveAuditNetwork", () => {
  it("maps a target that resolves to loopback through the configured host gateway", async () => {
    const lookup = async (hostname: string) => {
      if (hostname === "project.test") return [{ address: "127.0.0.1", family: 4 }];
      if (hostname === "host.docker.internal") return [{ address: "192.168.65.254", family: 4 }];
      return [];
    };

    await expect(resolveAuditNetwork("https://project.test", "host.docker.internal", lookup)).resolves.toEqual({
      chromiumArgs: ["--host-resolver-rules=MAP project.test 192.168.65.254", "--ignore-certificate-errors"],
      ignoreHTTPSErrors: true
    });
  });

  it("does not remap a publicly routable target", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];

    await expect(resolveAuditNetwork("https://example.com", "host.docker.internal", lookup)).resolves.toEqual({
      chromiumArgs: [],
      ignoreHTTPSErrors: false
    });
  });

  it("does not remap loopback unless a host gateway is configured", async () => {
    const lookup = async () => [{ address: "127.0.0.1", family: 4 }];

    await expect(resolveAuditNetwork("https://project.test", undefined, lookup)).resolves.toEqual({
      chromiumArgs: [],
      ignoreHTTPSErrors: false
    });
  });
});
