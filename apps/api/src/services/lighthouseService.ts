import { chromium } from "playwright";
import net from "node:net";
import { resolveAuditNetwork } from "../audit/network-target.js";
import { runLighthouseRecheck } from "../audit/lighthouse.js";
import type { lighthouseRecheckSchema } from "../validation.js";
import type { z } from "zod";

type LighthouseRecheckInput = z.infer<typeof lighthouseRecheckSchema>;

export async function recheckLighthouse(input: LighthouseRecheckInput) {
  const auditNetwork = await resolveAuditNetwork(input.url);
  const lighthousePort = await getOpenPort();
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${lighthousePort}`, ...auditNetwork.chromiumArgs]
  });

  try {
    return await runLighthouseRecheck(input.url, lighthousePort, input.device, input.targetScores);
  } finally {
    await browser.close();
  }
}

function getOpenPort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) resolve(address.port);
        else reject(new Error("Unable to allocate remote debugging port"));
      });
    });
  });
}
