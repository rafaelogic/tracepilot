import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";

interface ResolvedAddress {
  address: string;
  family: number;
}

type Lookup = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultLookup: Lookup = (hostname) => dnsLookup(hostname, { all: true });

export async function resolveAuditNetwork(targetUrl: string, hostGateway = process.env.AUDIT_HOST_GATEWAY, lookup = defaultLookup) {
  const direct = { chromiumArgs: [] as string[], ignoreHTTPSErrors: false };
  if (!hostGateway) return direct;

  const hostname = new URL(targetUrl).hostname;
  const targetAddresses = await lookup(hostname);
  if (targetAddresses.length === 0 || !targetAddresses.every(({ address }) => isLoopback(address))) return direct;

  const gatewayAddresses = await lookup(hostGateway);
  const gateway = gatewayAddresses.find(({ address, family }) => family === 4 && net.isIP(address) === 4);
  if (!gateway) return direct;

  return {
    chromiumArgs: [`--host-resolver-rules=MAP ${hostname} ${gateway.address}`, "--ignore-certificate-errors"],
    ignoreHTTPSErrors: true
  };
}

function isLoopback(address: string) {
  return address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
}
