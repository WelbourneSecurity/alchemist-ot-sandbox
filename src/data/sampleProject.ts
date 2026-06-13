import { PROJECT_SCHEMA_VERSION, type Asset, type AssetTypeId, type OtProject, type ZoneId } from "../models/types";

const controls = {
  strong: {
    mfa: true,
    allowListing: true,
    endpointProtection: true,
    patchingProgram: true,
    backups: true,
    defaultCredentialsDisabled: true,
    networkMonitoring: true,
    centralLogging: true,
    remoteAccessApproved: true,
    safetyValidated: true
  },
  moderate: {
    mfa: true,
    allowListing: false,
    endpointProtection: true,
    patchingProgram: true,
    backups: true,
    defaultCredentialsDisabled: true,
    networkMonitoring: true,
    centralLogging: false,
    remoteAccessApproved: true,
    safetyValidated: false
  },
  weak: {
    mfa: false,
    allowListing: false,
    endpointProtection: false,
    patchingProgram: false,
    backups: false,
    defaultCredentialsDisabled: false,
    networkMonitoring: false,
    centralLogging: false,
    remoteAccessApproved: false,
    safetyValidated: false
  }
};

const conduitDefaults = {
  protocolFamily: "auto" as const,
  ruleOwner: "OT network owner",
  businessJustification: "Documented operational requirement",
  reviewDate: "",
  expiryDate: "",
  monitoringSource: "",
  inspectionPoint: "",
  temporaryAccess: false,
  businessCritical: false
};

const laneY: Record<ZoneId, number> = {
  level5: -3,
  level4: 115,
  level3: 233,
  level2: 351,
  level1: 469,
  level0: 587
};

function asset(
  id: string,
  name: string,
  type: AssetTypeId,
  zone: ZoneId,
  x: number,
  y: number,
  overrides: Partial<Asset> = {}
): Asset {
  return {
    id,
    name,
    type,
    zone,
    ipAddress: "",
    vlan: "",
    protocols: [],
    criticality: "medium",
    owner: "OT operations",
    notes: "",
    position: { x, y },
    controls: controls.moderate,
    manufacturer: "",
    model: "",
    firmwareVersion: "",
    lifecycleStatus: "unknown",
    siteArea: "",
    patchWindow: "",
    backupStatus: "unknown",
    criticalProcessTag: "",
    ...overrides
  };
}

export const sampleProject: OtProject = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  id: "sample-purdue-assessment",
  name: "Sample Purdue Assessment",
  updatedAt: new Date().toISOString(),
  assumptions: [
    { id: "advisory", label: "Advisory score only; this is not ISA/IEC 62443 certification." },
    { id: "logical", label: "Topology is a logical model based on declared conduits, not live packet capture." },
    { id: "local", label: "Project data remains in the browser unless exported by the user." }
  ],
  assets: [
    asset("corp-it", "Corporate IT", "enterprise-it", "level5", 96, laneY.level5, {
      ipAddress: "10.10.0.0/16",
      vlan: "IT",
      protocols: ["HTTPS", "RDP", "SMB"],
      criticality: "high",
      controls: controls.strong
    }),
    asset("erp", "ERP / Planning", "enterprise-it", "level4", 432, laneY.level4, {
      ipAddress: "10.20.12.0/24",
      vlan: "BUS-210",
      protocols: ["HTTPS", "SQL"],
      criticality: "medium",
      controls: controls.strong
    }),
    asset("vendor-vpn", "Vendor VPN", "vendor-remote", "level5", 768, laneY.level5, {
      ipAddress: "198.51.100.20",
      vlan: "EXT",
      protocols: ["VPN", "RDP"],
      criticality: "high",
      owner: "Approved vendor",
      controls: { ...controls.moderate, mfa: false, remoteAccessApproved: true }
    }),
    asset("edge-fw", "IT / OT Firewall", "firewall", "level3", 144, laneY.level3, {
      ipAddress: "10.35.0.1",
      vlan: "IDMZ",
      criticality: "critical",
      controls: controls.strong
    }),
    asset("jump-host", "OT Jump Host", "jump-host", "level3", 432, laneY.level3, {
      ipAddress: "10.35.10.12",
      vlan: "IDMZ-350",
      protocols: ["RDP", "SSH"],
      criticality: "critical",
      controls: controls.strong
    }),
    asset("hist-replica", "Historian Replica", "historian", "level3", 720, laneY.level3, {
      ipAddress: "10.35.20.15",
      vlan: "IDMZ-351",
      protocols: ["OPC UA", "HTTPS"],
      criticality: "high",
      controls: controls.strong
    }),
    asset("ops-historian", "Site Historian", "historian", "level3", 1008, laneY.level3, {
      ipAddress: "10.30.22.10",
      vlan: "OT-300",
      protocols: ["OPC UA", "SQL"],
      criticality: "high",
      controls: controls.moderate
    }),
    asset("eng-ws", "Engineering WS", "engineering-workstation", "level2", 240, laneY.level2, {
      ipAddress: "10.22.10.55",
      vlan: "CTRL-220",
      protocols: ["RDP", "Vendor Tooling", "Modbus TCP"],
      criticality: "critical",
      controls: { ...controls.moderate, allowListing: false, centralLogging: false }
    }),
    asset("hmi-line1", "Line 1 HMI", "hmi", "level2", 528, laneY.level2, {
      ipAddress: "10.22.10.80",
      vlan: "CTRL-220",
      protocols: ["OPC UA", "HTTPS"],
      criticality: "high",
      controls: controls.moderate
    }),
    asset("scada", "Packaging SCADA", "scada", "level2", 816, laneY.level2, {
      ipAddress: "10.22.10.30",
      vlan: "CTRL-220",
      protocols: ["OPC UA", "Modbus TCP"],
      criticality: "critical",
      controls: controls.moderate
    }),
    asset("plc-pack", "Packaging PLC", "plc-rtu", "level1", 432, laneY.level1, {
      ipAddress: "10.11.30.14",
      vlan: "PLC-110",
      protocols: ["Modbus TCP", "EtherNet/IP"],
      criticality: "critical",
      controls: { ...controls.weak, defaultCredentialsDisabled: true }
    }),
    asset("wireless-gw", "Wireless Gateway", "wireless-gateway", "level1", 720, laneY.level1, {
      ipAddress: "10.11.31.8",
      vlan: "WIFI-111",
      protocols: ["WirelessHART", "HTTPS"],
      criticality: "high",
      controls: controls.moderate
    }),
    asset("sis", "Safety Controller", "safety-system", "level1", 144, laneY.level1, {
      ipAddress: "10.9.0.20",
      vlan: "SIS-090",
      protocols: ["Vendor Safety Protocol"],
      criticality: "critical",
      controls: { ...controls.strong, safetyValidated: true }
    }),
    asset("field-io", "Field I/O", "field-device", "level0", 528, laneY.level0, {
      ipAddress: "10.0.40.0/24",
      vlan: "FIELD-040",
      protocols: ["HART", "Profinet"],
      criticality: "high",
      controls: controls.weak
    })
  ],
  conduits: [
    {
      ...conduitDefaults,
      id: "c-it-fw",
      source: "corp-it",
      target: "edge-fw",
      name: "IT to IDMZ services",
      protocol: "HTTPS",
      port: "443",
      direction: "source-to-target",
      control: "firewalled",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: true,
      encrypted: true,
      jumpHostRequired: false,
      notes: "Corporate users can reach published IDMZ services only."
    },
    {
      ...conduitDefaults,
      id: "c-erp-replica",
      source: "erp",
      target: "hist-replica",
      name: "Business reporting pull",
      protocol: "HTTPS",
      port: "443",
      direction: "target-to-source",
      control: "firewalled",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: true,
      encrypted: true,
      jumpHostRequired: false,
      notes: "Replica publishes sanitized production data."
    },
    {
      ...conduitDefaults,
      id: "c-vpn-jump",
      source: "vendor-vpn",
      target: "jump-host",
      name: "Vendor support tunnel",
      protocol: "RDP",
      port: "3389",
      direction: "source-to-target",
      control: "jump-host",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: false,
      encrypted: true,
      jumpHostRequired: true,
      ruleOwner: "Vendor access owner",
      businessJustification: "Approved vendor support route to the OT jump host",
      monitoringSource: "VPN concentrator",
      notes: "Missing central session logging."
    },
    {
      ...conduitDefaults,
      id: "c-jump-eng",
      source: "jump-host",
      target: "eng-ws",
      name: "Brokered engineering access",
      protocol: "RDP",
      port: "3389",
      direction: "source-to-target",
      control: "jump-host",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: true,
      encrypted: true,
      jumpHostRequired: true,
      ruleOwner: "OT operations",
      businessJustification: "Brokered engineering support path",
      monitoringSource: "Jump host session logs",
      notes: "Privileged access path."
    },
    {
      ...conduitDefaults,
      id: "c-replica-sitehist",
      source: "ops-historian",
      target: "hist-replica",
      name: "Historian replication",
      protocol: "OPC UA",
      port: "4840",
      direction: "source-to-target",
      control: "firewalled",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: true,
      encrypted: true,
      jumpHostRequired: false,
      notes: "Outbound replication into IDMZ."
    },
    {
      ...conduitDefaults,
      id: "c-scada-hmi",
      source: "scada",
      target: "hmi-line1",
      name: "Supervisory display",
      protocol: "OPC UA",
      port: "4840",
      direction: "bidirectional",
      control: "routed",
      firewallRule: "explicit",
      trustBoundary: false,
      inspected: false,
      logged: false,
      encrypted: false,
      jumpHostRequired: false,
      notes: "Same-zone supervisory traffic."
    },
    {
      ...conduitDefaults,
      id: "c-scada-plc",
      source: "scada",
      target: "plc-pack",
      name: "SCADA to PLC",
      protocol: "Modbus TCP",
      port: "502",
      direction: "bidirectional",
      control: "routed",
      firewallRule: "any-any",
      trustBoundary: true,
      inspected: false,
      logged: false,
      encrypted: false,
      jumpHostRequired: false,
      ruleOwner: "",
      businessJustification: "",
      notes: "Broad control network rule."
    },
    {
      ...conduitDefaults,
      id: "c-eng-plc",
      source: "eng-ws",
      target: "plc-pack",
      name: "Engineering download",
      protocol: "Vendor Tooling",
      port: "44818",
      direction: "bidirectional",
      control: "routed",
      firewallRule: "unknown",
      trustBoundary: true,
      inspected: false,
      logged: false,
      encrypted: false,
      jumpHostRequired: false,
      temporaryAccess: true,
      ruleOwner: "",
      businessJustification: "",
      notes: "Review whether this should be temporary and change-controlled."
    },
    {
      ...conduitDefaults,
      id: "c-plc-field",
      source: "plc-pack",
      target: "field-io",
      name: "Control I/O",
      protocol: "Profinet",
      port: "34964",
      direction: "bidirectional",
      control: "routed",
      firewallRule: "explicit",
      trustBoundary: false,
      inspected: false,
      logged: false,
      encrypted: false,
      jumpHostRequired: false,
      notes: "Field control traffic."
    },
    {
      ...conduitDefaults,
      id: "c-plc-sis",
      source: "plc-pack",
      target: "sis",
      name: "Safety interlock status",
      protocol: "Vendor Safety Protocol",
      port: "1962",
      direction: "bidirectional",
      control: "routed",
      firewallRule: "unknown",
      trustBoundary: true,
      inspected: false,
      logged: false,
      encrypted: false,
      jumpHostRequired: false,
      ruleOwner: "",
      businessJustification: "",
      notes: "Validate whether this should be read-only or data diode."
    },
    {
      ...conduitDefaults,
      id: "c-wireless-plc",
      source: "wireless-gw",
      target: "plc-pack",
      name: "Wireless telemetry",
      protocol: "HTTPS",
      port: "443",
      direction: "source-to-target",
      control: "firewalled",
      firewallRule: "explicit",
      trustBoundary: true,
      inspected: true,
      logged: false,
      encrypted: true,
      jumpHostRequired: false,
      notes: "Wireless path lacks centralized logging."
    }
  ]
};

export const blankProject: OtProject = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  id: "blank-ot-assessment",
  name: "Untitled OT Assessment",
  updatedAt: new Date().toISOString(),
  assumptions: [
    { id: "advisory", label: "Advisory score only; this is not ISA/IEC 62443 certification." },
    { id: "logical", label: "Topology is a logical model based on declared conduits, not live packet capture." },
    { id: "local", label: "Project data remains in the browser unless exported by the user." }
  ],
  assets: [],
  conduits: []
};
