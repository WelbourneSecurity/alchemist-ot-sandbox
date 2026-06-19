export type KbCategory = "Frameworks" | "Asset & risk" | "Architecture" | "Operations";

export interface KbSection {
  heading: string;
  points: string[];
}

export interface KbTopic {
  id: string;
  title: string;
  category: KbCategory;
  summary: string;
  sections: KbSection[];
  references: string[];
}

export const kbCategories: KbCategory[] = ["Frameworks", "Asset & risk", "Architecture", "Operations"];

/**
 * A browsable OT reference library for engineers and consultants — frameworks, asset
 * management, architecture and operations. Static, data-driven so topics are easy to extend.
 */
export const knowledgeBase: KbTopic[] = [
  {
    id: "asset-registers",
    title: "OT asset registers & inventory",
    category: "Asset & risk",
    summary:
      "A complete, current inventory of OT assets, connections and data flows is the foundation of every framework — you cannot protect, patch or assess what you cannot see.",
    sections: [
      {
        heading: "What to capture per asset",
        points: [
          "Identity: name/tag, function, criticality to the essential function.",
          "Make, model, firmware/OS version and lifecycle status (supported / limited / end-of-life).",
          "Network: IP/MAC, VLAN/subnet, Purdue zone and the conduits it talks over.",
          "Protocols and exposed services; owner and physical location/site area.",
          "Security posture: patch level, backups, MFA, default-credential status."
        ]
      },
      {
        heading: "How to build and keep it current",
        points: [
          "Prefer passive discovery (SPAN/TAP with a tool like Zeek) to avoid disturbing the process.",
          "Use active scanning only with care and change control; enrich with vendor exports and physical walkdowns.",
          "Map data flows, not just hosts — conduits and trust boundaries matter as much as assets.",
          "Tie updates to management-of-change so the register does not drift."
        ]
      },
      {
        heading: "Common pitfalls",
        points: [
          "Stale inventories, missing Level 0/1 field devices, and undocumented vendor/remote connections.",
          "Spreadsheets with no owner; no link from assets to risks or findings."
        ]
      }
    ],
    references: ["NCSC CAF Principle A3", "ISA/IEC 62443-2-1", "NIST SP 800-82 Rev. 3", "CISA OT asset inventory guidance"]
  },
  {
    id: "iec-62443",
    title: "ISA/IEC 62443 for OT",
    category: "Frameworks",
    summary:
      "The international series for securing Industrial Automation and Control Systems (IACS). It defines zones and conduits, Security Levels, and requirements for asset owners, integrators and product suppliers.",
    sections: [
      {
        heading: "Key parts of the series",
        points: [
          "2-1: establishing an IACS security programme (the asset owner's management system).",
          "2-4: security requirements for service providers / integrators.",
          "3-2: risk assessment, and partitioning the system into zones and conduits.",
          "3-3: system security requirements and Security Levels (SL).",
          "4-1 / 4-2: secure product development lifecycle and component requirements."
        ]
      },
      {
        heading: "Zones, conduits & Security Levels",
        points: [
          "Group assets of similar risk into zones; control every flow between zones through a defined conduit.",
          "Each zone has a target SL (SL-T) and an achieved SL (SL-A) on a 0–4 scale.",
          "SL-A is judged against the seven Foundational Requirements (FR1–FR7) and is capped by the weakest one."
        ]
      },
      {
        heading: "The seven Foundational Requirements",
        points: [
          "FR1 Identification & authentication, FR2 Use control, FR3 System integrity, FR4 Data confidentiality.",
          "FR5 Restricted data flow, FR6 Timely response to events, FR7 Resource availability."
        ]
      }
    ],
    references: ["ISA/IEC 62443-3-2", "ISA/IEC 62443-3-3", "ISA/IEC 62443-2-1"]
  },
  {
    id: "nist-csf-2",
    title: "NIST CSF 2.0 in OT",
    category: "Frameworks",
    summary:
      "The NIST Cybersecurity Framework 2.0 (2024) organises outcomes under six functions. The new Govern function makes it a strong fit for the governance and risk side of OT/GRC.",
    sections: [
      {
        heading: "The six functions",
        points: [
          "Govern (new): organisational context, risk management strategy, roles, policy and supply chain.",
          "Identify: assets, risk and improvement opportunities.",
          "Protect: safeguards (access control, data security, platform & resilience).",
          "Detect: find and analyse possible attacks and compromises.",
          "Respond & Recover: act on detected incidents and restore operations."
        ]
      },
      {
        heading: "Applying it to OT",
        points: [
          "Lead with consequence: safety and availability outrank confidentiality.",
          "Use Profiles to express the target vs current state for a specific facility or mission.",
          "Pair CSF 2.0 (the what) with NIST SP 800-82 (the how) for OT-specific control tailoring."
        ]
      }
    ],
    references: ["NIST CSF 2.0", "NIST SP 800-82 Rev. 3"]
  },
  {
    id: "nist-800-82",
    title: "NIST SP 800-82 (OT security)",
    category: "Frameworks",
    summary:
      "The US guide to Operational Technology security. Revision 3 (2023) broadened it from ICS to OT, aligned it to the CSF, and provides an OT overlay of SP 800-53 controls.",
    sections: [
      {
        heading: "What it gives you",
        points: [
          "A clear treatment of how OT differs from IT (availability, safety, legacy, real-time constraints).",
          "OT risk management, architecture and a tailored control baseline (the OT overlay to SP 800-53).",
          "Guidance you can cite when justifying compensating controls for assets that cannot be patched."
        ]
      }
    ],
    references: ["NIST SP 800-82 Rev. 3", "NIST SP 800-53"]
  },
  {
    id: "purdue-segmentation",
    title: "Purdue model & network segmentation",
    category: "Architecture",
    summary:
      "The Purdue reference architecture layers an OT network from the process (Level 0) up to enterprise IT (Level 5), with an IT/OT DMZ in between. Segmentation contains compromise and protects the essential function.",
    sections: [
      {
        heading: "The levels",
        points: [
          "L0 process (sensors/actuators), L1 basic control (PLC/RTU), L2 supervisory (SCADA/HMI).",
          "L3 operations (historians, MES, OT services), L3.5 IT/OT DMZ, L4–L5 business / enterprise IT."
        ]
      },
      {
        heading: "Segmentation techniques",
        points: [
          "Deny-by-default firewalls between zones; publish services through the IDMZ, never direct IT→control.",
          "Broker administrative access through jump hosts; use data diodes for one-way historian/telemetry flows.",
          "Keep safety systems (SIS) independent of the basic process control system."
        ]
      }
    ],
    references: ["ISA-95 / Purdue model", "ISA/IEC 62443-3-2", "NIST SP 800-82 Rev. 3"]
  },
  {
    id: "secure-remote-access",
    title: "Secure remote access for OT",
    category: "Operations",
    summary:
      "Vendor and engineer remote access is one of the most common OT intrusion paths. Broker, authenticate, time-box and monitor every session.",
    sections: [
      {
        heading: "Good practice",
        points: [
          "No direct vendor access to control assets — terminate in the IDMZ and broker via a jump host / PAM.",
          "Enforce MFA, least privilege and named accounts; remove shared and default credentials.",
          "Make access on-demand and time-boxed; record and monitor sessions; review and revoke promptly."
        ]
      }
    ],
    references: ["NCSC CAF Principles A4 & B2", "ISA/IEC 62443-3-3", "CISA remote access guidance"]
  },
  {
    id: "ot-protocols",
    title: "OT protocols & legacy exposure",
    category: "Architecture",
    summary:
      "Most industrial protocols were designed for trusted networks and lack native authentication or encryption. Treat them as fragile and protect them with the network around them.",
    sections: [
      {
        heading: "Common protocols",
        points: [
          "Modbus TCP, DNP3, EtherNet/IP, PROFINET, S7, IEC 61850 (MMS/GOOSE), BACnet — generally no built-in security.",
          "OPC UA and HTTPS can be secured (certificates, encryption) — verify they are actually configured."
        ]
      },
      {
        heading: "Mitigations",
        points: [
          "Restrict each protocol to the minimum necessary peers and ports; deny across trust boundaries.",
          "Monitor for unauthorised command messages and unexpected engineering traffic.",
          "Prefer secured variants (e.g. OPC UA with security policies) where the equipment supports them."
        ]
      }
    ],
    references: ["ISA/IEC 62443-3-3 FR3/FR4", "NIST SP 800-82 Rev. 3", "MITRE ATT&CK for ICS"]
  },
  {
    id: "patch-vuln-eol",
    title: "Patching, vulnerabilities & end-of-life",
    category: "Operations",
    summary:
      "OT patching is constrained by availability, vendor validation and downtime windows. Manage vulnerabilities by risk, and compensate where patching is not possible.",
    sections: [
      {
        heading: "Practical approach",
        points: [
          "Track advisories (CISA ICS-CERT, vendor PSIRTs) against your asset register.",
          "Patch in approved maintenance windows with vendor sign-off; test first where feasible.",
          "For end-of-life or un-patchable assets, apply compensating controls: isolation, allow-listing, monitoring.",
          "Record the residual risk and treatment decision rather than leaving it implicit."
        ]
      }
    ],
    references: ["NIST SP 800-82 Rev. 3", "ISA/IEC 62443-2-3 (patch management)", "CISA ICS advisories"]
  },
  {
    id: "monitoring-detection",
    title: "OT monitoring & detection",
    category: "Operations",
    summary:
      "You can only respond to what you can see. OT-aware, mostly-passive monitoring detects intrusions and abnormal control activity without disturbing the process.",
    sections: [
      {
        heading: "What good looks like",
        points: [
          "Passive network monitoring (SPAN/TAP) that understands OT protocols and baselines normal traffic.",
          "Centralised, time-synced logging from OT hosts, jump hosts and security devices.",
          "Use cases tuned for OT: new devices, unexpected engineering connections, unauthorised commands.",
          "Proactive review / threat hunting for what signatures miss (CAF C2)."
        ]
      }
    ],
    references: ["NCSC CAF Principles C1 & C2", "ISA/IEC 62443-3-3 FR6", "NIST SP 800-82 Rev. 3"]
  },
  {
    id: "incident-response",
    title: "OT incident response & recovery",
    category: "Operations",
    summary:
      "OT incident response must account for safety and the ability to keep operating. Plan, exercise and validate recovery before you need it.",
    sections: [
      {
        heading: "Key elements",
        points: [
          "OT-specific response plans with clear roles, safe-state / safe-shutdown procedures and decision authority.",
          "Validated, offline backups of control logic, configurations and golden images — and tested restoration.",
          "Exercises and post-incident reviews that feed lessons back into controls and training (CAF D1/D2).",
          "Engagement with the regulator / national authority where the essential function is affected."
        ]
      }
    ],
    references: ["NCSC CAF Principles D1 & D2", "ISA/IEC 62443-3-3 FR7", "NIST SP 800-82 Rev. 3"]
  },
  {
    id: "supply-chain",
    title: "Supply chain & vendor risk",
    category: "Asset & risk",
    summary:
      "Integrators, OEMs and the components they ship introduce risk you do not directly control. Understand it, require security contractually, and manage vendor access.",
    sections: [
      {
        heading: "Managing the risk",
        points: [
          "Know your suppliers and the access and components they provide to the essential function.",
          "Set security expectations in contracts; prefer products built to a secure development lifecycle (62443-4-1).",
          "Broker and monitor all vendor remote access; review what integrators leave behind after commissioning.",
          "Consider component provenance and firmware integrity (62443-4-2)."
        ]
      }
    ],
    references: ["NCSC CAF Principle A4", "ISA/IEC 62443-2-4", "ISA/IEC 62443-4-1 / 4-2"]
  }
];
