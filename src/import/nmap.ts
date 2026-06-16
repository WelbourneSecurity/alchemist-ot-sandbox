import { childrenNamed, findAll, firstChild, parseXml } from "./xml";
import type { ImportedHost, ImportedPort, ParsedImport } from "./types";

/**
 * Parses Nmap XML (`nmap -oX`). Each up host becomes a normalized host with its open TCP/UDP
 * ports, MAC vendor, hostname and OS guess — enough for the assembler to infer an asset type
 * and protocols. Nmap is an active host/port scan, so it yields assets but no host-to-host
 * flows (those come from the passive/flow formats).
 */
export function parseNmapXml(text: string): ParsedImport {
  const doc = parseXml(text);
  const warnings: string[] = [];
  const hosts: ImportedHost[] = [];

  const hostNodes = findAll(doc, "host");
  if (hostNodes.length === 0) {
    warnings.push("No <host> elements found — is this an Nmap XML (-oX) export?");
  }

  let down = 0;
  for (const hostNode of hostNodes) {
    const status = firstChild(hostNode, "status");
    if (status && status.attrs.state && status.attrs.state !== "up") {
      down += 1;
      continue;
    }

    let ip: string | undefined;
    let mac: string | undefined;
    let vendor: string | undefined;
    for (const address of childrenNamed(hostNode, "address")) {
      const kind = address.attrs.addrtype;
      if (kind === "ipv4" || kind === "ipv6") {
        ip = ip ?? address.attrs.addr;
      } else if (kind === "mac") {
        mac = address.attrs.addr;
        vendor = address.attrs.vendor || vendor;
      }
    }

    const hostname = findAll(hostNode, "hostname")[0]?.attrs.name;
    const os = findAll(hostNode, "osmatch")[0]?.attrs.name;

    const ports: ImportedPort[] = [];
    for (const portNode of findAll(hostNode, "port")) {
      const state = firstChild(portNode, "state");
      if (state && state.attrs.state && !state.attrs.state.startsWith("open")) {
        continue;
      }
      const portId = Number(portNode.attrs.portid);
      if (!Number.isFinite(portId)) {
        continue;
      }
      const service = firstChild(portNode, "service");
      ports.push({
        port: portId,
        transport: portNode.attrs.protocol,
        service: service?.attrs.name,
        product: service?.attrs.product
      });
    }

    if (!ip && !hostname) {
      continue;
    }
    hosts.push({ ip, mac, vendor, hostname, os, ports });
  }

  if (down > 0) {
    warnings.push(`Skipped ${down} host${down === 1 ? "" : "s"} reported as down.`);
  }

  return { format: "nmap-xml", hosts, flows: [], warnings };
}
