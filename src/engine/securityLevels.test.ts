import { describe, expect, it } from "vitest";
import { zones } from "../data/catalog";
import { sampleProject } from "../data/sampleProject";
import { MAX_SL, assessSecurityLevels, defaultTargetSL, foundationalRequirements } from "./securityLevels";

describe("assessSecurityLevels", () => {
  it("assesses every zone with target and achieved SL in range", () => {
    const result = assessSecurityLevels(sampleProject);
    expect(result.zones).toHaveLength(zones.length);

    for (const zone of result.zones) {
      expect(zone.target).toBeGreaterThanOrEqual(1);
      expect(zone.target).toBeLessThanOrEqual(MAX_SL);
      expect(zone.achieved).toBeGreaterThanOrEqual(0);
      expect(zone.achieved).toBeLessThanOrEqual(MAX_SL);

      // SL-A is capped by the weakest Foundational Requirement.
      const weakest = Math.min(...foundationalRequirements.map((fr) => zone.frLevels[fr.id]));
      expect(zone.achieved).toBe(weakest);

      // The limiting FRs are exactly those sitting at the achieved level.
      expect(zone.limiting.length).toBeGreaterThan(0);
      for (const fr of zone.limiting) {
        expect(zone.frLevels[fr]).toBe(zone.achieved);
      }
    }
  });

  it("defaults control zones to a stronger target than enterprise zones", () => {
    expect(defaultTargetSL("level1")).toBeGreaterThan(defaultTargetSL("level5"));
  });

  it("respects zoneTargets overrides", () => {
    const result = assessSecurityLevels(sampleProject, { level1: 2 });
    expect(result.zones.find((zone) => zone.zone === "level1")?.target).toBe(2);
  });

  it("treats an empty zone as vacuously satisfied (max SL)", () => {
    const result = assessSecurityLevels({ ...sampleProject, assets: [], conduits: [] });
    for (const zone of result.zones) {
      expect(zone.achieved).toBe(MAX_SL);
    }
  });
});
