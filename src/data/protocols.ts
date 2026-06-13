import type { Conduit, ProtocolFamilyId } from "../models/types";

export interface ProtocolFamilyDefinition {
  id: Exclude<ProtocolFamilyId, "auto">;
  label: string;
  color: string;
  shortLabel: string;
  riskNote: string;
  aliases: string[];
  ports: string[];
}

export const protocolFamilies: ProtocolFamilyDefinition[] = [
  {
    id: "https-tls",
    label: "HTTPS / TLS",
    shortLabel: "TLS",
    color: "#17a2a4",
    riskNote: "Encrypted application traffic. Confirm inspection, certificate ownership, and exact destinations at boundaries.",
    aliases: ["https", "tls", "ssl", "wss"],
    ports: ["443", "8443", "9443"]
  },
  {
    id: "http",
    label: "HTTP",
    shortLabel: "HTTP",
    color: "#f28e2b",
    riskNote: "Cleartext web traffic. Avoid across trust boundaries unless there is a compensating control.",
    aliases: ["http"],
    ports: ["80", "8080", "8000"]
  },
  {
    id: "modbus",
    label: "Modbus TCP",
    shortLabel: "MBTCP",
    color: "#e15759",
    riskNote: "Legacy industrial protocol with limited native security. Restrict to necessary peers and monitor closely.",
    aliases: ["modbus", "modbus tcp", "mbtcp"],
    ports: ["502"]
  },
  {
    id: "opc",
    label: "OPC",
    shortLabel: "OPC",
    color: "#4e79a7",
    riskNote: "Common OT data exchange. Prefer OPC UA security profiles and broker through the IDMZ where practical.",
    aliases: ["opc", "opc ua", "opc da", "opc-ua", "opc-da"],
    ports: ["135", "4840"]
  },
  {
    id: "dnp3",
    label: "DNP3",
    shortLabel: "DNP3",
    color: "#b07aa1",
    riskNote: "Utility and telemetry protocol. Confirm secure authentication, directionality, and monitoring.",
    aliases: ["dnp3", "dnp"],
    ports: ["20000"]
  },
  {
    id: "ethernet-ip",
    label: "EtherNet/IP",
    shortLabel: "EIP",
    color: "#59a14f",
    riskNote: "Controller communication. Limit engineering and controller paths to approved change windows.",
    aliases: ["ethernet/ip", "ethernet ip", "ethernet-ip", "cip"],
    ports: ["44818", "2222"]
  },
  {
    id: "profinet",
    label: "Profinet",
    shortLabel: "PN",
    color: "#edc948",
    riskNote: "Industrial control traffic. Avoid unnecessary routing outside the cell or area.",
    aliases: ["profinet", "profibus"],
    ports: ["34962", "34963", "34964"]
  },
  {
    id: "s7",
    label: "S7",
    shortLabel: "S7",
    color: "#76b7b2",
    riskNote: "Controller programming and data traffic. Restrict write-capable paths and monitor engineering activity.",
    aliases: ["s7", "siemens s7", "s7comm", "s7comm-plus"],
    ports: ["102"]
  },
  {
    id: "rdp",
    label: "RDP",
    shortLabel: "RDP",
    color: "#af7aa1",
    riskNote: "Interactive administration. Require named users, MFA where possible, jump-host control, and session logging.",
    aliases: ["rdp", "remote desktop"],
    ports: ["3389"]
  },
  {
    id: "ssh",
    label: "SSH",
    shortLabel: "SSH",
    color: "#9c755f",
    riskNote: "Administrative shell access. Restrict privileged access and record boundary sessions.",
    aliases: ["ssh", "sftp", "scp"],
    ports: ["22"]
  },
  {
    id: "smb",
    label: "SMB",
    shortLabel: "SMB",
    color: "#ff9da7",
    riskNote: "File sharing and lateral movement risk. Avoid direct IT-to-OT exposure.",
    aliases: ["smb", "cifs", "windows file sharing"],
    ports: ["445", "139"]
  },
  {
    id: "dns-ntp",
    label: "DNS / NTP",
    shortLabel: "DNS/NTP",
    color: "#bab0ab",
    riskNote: "Infrastructure dependency. Confirm trusted resolvers, time sources, and boundary logging.",
    aliases: ["dns", "ntp", "time sync", "snmp"],
    ports: ["53", "123", "161", "162"]
  },
  {
    id: "mqtt",
    label: "MQTT",
    shortLabel: "MQTT",
    color: "#86bc86",
    riskNote: "Publish/subscribe telemetry. Confirm broker placement, authentication, and topic permissions.",
    aliases: ["mqtt", "mqtts"],
    ports: ["1883", "8883"]
  },
  {
    id: "vpn",
    label: "VPN",
    shortLabel: "VPN",
    color: "#d37295",
    riskNote: "Remote access entry point. Require approval, MFA, jump-host mediation, and session monitoring.",
    aliases: ["vpn", "ipsec", "wireguard", "openvpn", "ssl vpn", "vendor vpn"],
    ports: ["500", "4500", "1194", "51820"]
  },
  {
    id: "unknown",
    label: "Unknown",
    shortLabel: "UNK",
    color: "#8e979c",
    riskNote: "Undocumented protocol. Confirm business purpose, owner, port, and exact permit rule.",
    aliases: ["unknown", "any", "*"],
    ports: []
  },
  {
    id: "other",
    label: "Other",
    shortLabel: "OTHER",
    color: "#c4cbd0",
    riskNote: "Custom or vendor-specific traffic. Document protocol behaviour and required peers.",
    aliases: [],
    ports: []
  }
];

const familyById = new Map(protocolFamilies.map((family) => [family.id, family]));

export function getProtocolFamilyDefinition(id: ProtocolFamilyId): ProtocolFamilyDefinition {
  if (id === "auto") {
    return familyById.get("other")!;
  }
  return familyById.get(id) ?? familyById.get("other")!;
}

export function classifyProtocol(protocol: string, port = ""): Exclude<ProtocolFamilyId, "auto"> {
  const normalizedProtocol = protocol.trim().toLowerCase();
  const normalizedPort = port.trim().toLowerCase();

  if (!normalizedProtocol && !normalizedPort) {
    return "unknown";
  }

  for (const family of protocolFamilies) {
    if (family.id === "other") {
      continue;
    }
    if (family.aliases.some((alias) => normalizedProtocol === alias || normalizedProtocol.includes(alias))) {
      return family.id;
    }
    if (normalizedPort && family.ports.includes(normalizedPort)) {
      return family.id;
    }
  }

  return "other";
}

export function resolveProtocolFamily(conduit: Pick<Conduit, "protocol" | "port" | "protocolFamily">): ProtocolFamilyDefinition {
  if (conduit.protocolFamily && conduit.protocolFamily !== "auto") {
    return getProtocolFamilyDefinition(conduit.protocolFamily);
  }
  return getProtocolFamilyDefinition(classifyProtocol(conduit.protocol, conduit.port));
}

export function protocolLabel(conduit: Pick<Conduit, "protocol" | "port" | "protocolFamily">) {
  const family = resolveProtocolFamily(conduit);
  const protocol = conduit.protocol.trim() || family.label;
  return conduit.port.trim() ? `${protocol}:${conduit.port.trim()}` : protocol;
}
