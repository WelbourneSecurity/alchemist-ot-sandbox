import { describe, expect, it } from "vitest";
import { parseNmapXml } from "./nmap";

const SAMPLE = `<?xml version="1.0"?>
<!DOCTYPE nmaprun>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="10.0.1.10" addrtype="ipv4"/>
    <address addr="00:1b:1b:00:00:01" addrtype="mac" vendor="Siemens"/>
    <hostnames><hostname name="plc-1" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="502"><state state="open"/><service name="modbus"/></port>
      <port protocol="tcp" portid="102"><state state="open"/><service name="iso-tsap"/></port>
      <port protocol="tcp" portid="23"><state state="closed"/><service name="telnet"/></port>
    </ports>
    <os><osmatch name="Embedded Linux" accuracy="90"/></os>
  </host>
  <host>
    <status state="down"/>
    <address addr="10.0.1.99" addrtype="ipv4"/>
  </host>
</nmaprun>`;

describe("parseNmapXml", () => {
  it("extracts up hosts with ip, mac vendor, hostname, os and open ports only", () => {
    const result = parseNmapXml(SAMPLE);
    expect(result.hosts).toHaveLength(1);
    const host = result.hosts[0];
    expect(host.ip).toBe("10.0.1.10");
    expect(host.mac).toBe("00:1b:1b:00:00:01");
    expect(host.vendor).toBe("Siemens");
    expect(host.hostname).toBe("plc-1");
    expect(host.os).toBe("Embedded Linux");
    expect(host.ports.map((port) => port.port)).toEqual([502, 102]);
  });

  it("warns about skipped down hosts and yields no flows", () => {
    const result = parseNmapXml(SAMPLE);
    expect(result.flows).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/down/i);
  });
});
