import { describe, expect, it } from "vitest";
import { sampleProject } from "../data/sampleProject";
import { assessProject } from "./scoring";
import { RISK_SCALE, assessRisk, consequenceFor, derivedConsequence, likelihoodForAsset, riskBand } from "./risk";

describe("assessRisk", () => {
  const findings = assessProject(sampleProject).findings;
  const result = assessRisk(sampleProject, findings);

  it("rates every asset with consequence, likelihood and score in range", () => {
    expect(result.assets).toHaveLength(sampleProject.assets.length);
    for (const risk of result.assets) {
      expect(risk.consequence).toBeGreaterThanOrEqual(1);
      expect(risk.consequence).toBeLessThanOrEqual(RISK_SCALE);
      expect(risk.likelihood).toBeGreaterThanOrEqual(1);
      expect(risk.likelihood).toBeLessThanOrEqual(RISK_SCALE);
      expect(risk.score).toBe(risk.consequence * risk.likelihood);
      expect(risk.band).toBe(riskBand(risk.score));
    }
  });

  it("sorts the register by descending risk score", () => {
    for (let i = 1; i < result.assets.length; i += 1) {
      expect(result.assets[i - 1].score).toBeGreaterThanOrEqual(result.assets[i].score);
    }
  });

  it("places every asset in the heat-map matrix", () => {
    const total = result.matrix.flat().reduce((sum, count) => sum + count, 0);
    expect(total).toBe(sampleProject.assets.length);
  });

  it("rates safety systems at the highest consequence", () => {
    const safety = sampleProject.assets.find((asset) => asset.type === "safety-system");
    if (safety) {
      expect(derivedConsequence(safety)).toBe(RISK_SCALE);
    }
  });

  it("honours an explicit consequence override", () => {
    expect(consequenceFor({ ...sampleProject.assets[0], consequence: 1 })).toBe(1);
  });

  it("gives findings-free assets the lowest likelihood", () => {
    expect(likelihoodForAsset("no-such-asset", findings)).toBe(1);
  });
});
