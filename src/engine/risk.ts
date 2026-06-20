import type { Asset, AssetTypeId, Finding, OtProject, Severity } from "../models/types";

/**
 * OT risk model: Risk = Likelihood × Consequence.
 *
 * Consequence is the impact if the asset is compromised or fails — derived from asset class
 * and criticality (assessor override via asset.consequence). Likelihood is driven by the
 * worst finding affecting the asset. Both sit on a 1–5 scale, giving a 1–25 risk score placed
 * on a heat-map — the consequence-led view that distinguishes OT risk from IT risk.
 */

export type RiskBand = "low" | "medium" | "high" | "critical";

export interface AssetRisk {
  assetId: string;
  consequence: number;
  likelihood: number;
  score: number;
  band: RiskBand;
}

export interface RiskAssessment {
  assets: AssetRisk[];
  /** matrix[consequence-1][likelihood-1] = number of assets in that cell. */
  matrix: number[][];
}

export const RISK_SCALE = 5;

const typeConsequence: Record<AssetTypeId, number> = {
  "safety-system": 5,
  "plc-rtu": 4,
  scada: 4,
  "field-device": 3,
  hmi: 3,
  "engineering-workstation": 3,
  "wireless-gateway": 3,
  historian: 2,
  firewall: 2,
  "jump-host": 2,
  "vendor-remote": 2,
  "enterprise-it": 2,
  "cloud-service": 2
};

const severityLikelihood: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2
};

function clamp(value: number): number {
  return Math.min(RISK_SCALE, Math.max(1, value));
}

/** Derived consequence when the assessor has not set one explicitly. */
export function derivedConsequence(asset: Asset): number {
  let consequence = typeConsequence[asset.type] ?? 2;
  if (asset.criticality === "critical") {
    consequence += 1;
  } else if (asset.criticality === "low") {
    consequence -= 1;
  }
  return clamp(consequence);
}

export function consequenceFor(asset: Asset): number {
  return asset.consequence !== undefined ? clamp(asset.consequence) : derivedConsequence(asset);
}

export function likelihoodForAsset(assetId: string, findings: Finding[]): number {
  const relevant = findings.filter((finding) => finding.affectedAssetIds.includes(assetId));
  if (relevant.length === 0) {
    return 1;
  }
  return Math.max(...relevant.map((finding) => severityLikelihood[finding.severity]));
}

export function riskBand(score: number): RiskBand {
  if (score >= 15) {
    return "critical";
  }
  if (score >= 9) {
    return "high";
  }
  if (score >= 4) {
    return "medium";
  }
  return "low";
}

export function assessRisk(project: OtProject, findings: Finding[]): RiskAssessment {
  const assets = project.assets
    .map((asset) => {
      const consequence = consequenceFor(asset);
      const likelihood = likelihoodForAsset(asset.id, findings);
      const score = consequence * likelihood;
      return { assetId: asset.id, consequence, likelihood, score, band: riskBand(score) };
    })
    .sort((a, b) => b.score - a.score);

  const matrix = Array.from({ length: RISK_SCALE }, () => Array.from({ length: RISK_SCALE }, () => 0));
  for (const risk of assets) {
    matrix[risk.consequence - 1][risk.likelihood - 1] += 1;
  }

  return { assets, matrix };
}

/** How many assets sit in the high or critical risk bands. */
export function countHighRisk(risk: RiskAssessment): number {
  return risk.assets.filter((asset) => asset.band === "critical" || asset.band === "high").length;
}
