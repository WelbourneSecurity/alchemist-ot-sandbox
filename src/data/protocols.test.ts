import { describe, expect, it } from "vitest";
import { classifyProtocol, resolveProtocolFamily } from "./protocols";
import type { Conduit } from "../models/types";

describe("protocol classification", () => {
  it("maps common OT and remote protocols to stable colour families", () => {
    expect(classifyProtocol("HTTPS", "443")).toBe("https-tls");
    expect(classifyProtocol("Modbus TCP", "502")).toBe("modbus");
    expect(classifyProtocol("OPC UA", "4840")).toBe("opc");
    expect(classifyProtocol("RDP", "3389")).toBe("rdp");
    expect(classifyProtocol("VPN", "")).toBe("vpn");
  });

  it("allows a manual protocol family override", () => {
    const conduit = {
      protocol: "Vendor Tooling",
      port: "44818",
      protocolFamily: "ethernet-ip"
    } as Pick<Conduit, "protocol" | "port" | "protocolFamily">;

    expect(resolveProtocolFamily(conduit).id).toBe("ethernet-ip");
  });
});
