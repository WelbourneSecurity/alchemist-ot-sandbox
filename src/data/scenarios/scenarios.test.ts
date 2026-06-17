import { describe, expect, it } from "vitest";
import { scenarios } from "./index";
import { assessProject } from "../../engine/scoring";
import { parseProjectJson, serializeProject } from "../../engine/serialization";

describe("sector scenarios", () => {
  it("ships the bundled scenarios with unique ids", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
    const ids = scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const scenario of scenarios) {
    describe(scenario.name, () => {
      const { project } = scenario;

      it("round-trips through serialization and validates", () => {
        const result = parseProjectJson(serializeProject(project));
        expect(result.ok).toBe(true);
      });

      it("has unique asset ids and resolvable conduit endpoints", () => {
        const ids = project.assets.map((asset) => asset.id);
        expect(new Set(ids).size).toBe(ids.length);
        const idSet = new Set(ids);
        for (const conduit of project.conduits) {
          expect(idSet.has(conduit.source)).toBe(true);
          expect(idSet.has(conduit.target)).toBe(true);
        }
      });

      it("assigns every subnetId to a declared subnet", () => {
        const subnetIds = new Set((project.subnets ?? []).map((subnet) => subnet.id));
        for (const asset of project.assets) {
          if (asset.subnetId) {
            expect(subnetIds.has(asset.subnetId)).toBe(true);
          }
        }
      });

      it("produces a non-trivial assessment", () => {
        const assessment = assessProject(project);
        expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
        expect(assessment.overallScore).toBeLessThanOrEqual(100);
        expect(assessment.findings.length).toBeGreaterThan(0);
      });
    });
  }
});
