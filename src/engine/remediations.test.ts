import { describe, expect, it } from "vitest";
import { applyRemediations, remediations } from "./remediations";
import { assessProject } from "./scoring";
import { sampleProject } from "../data/sampleProject";

const baseScore = assessProject(sampleProject).overallScore;

describe("remediations", () => {
  it("never lowers the advisory score on its own", () => {
    for (const remediation of remediations) {
      const score = assessProject(remediation.apply(sampleProject)).overallScore;
      expect(score).toBeGreaterThanOrEqual(baseScore);
    }
  });

  it("raises the score when every remediation is applied", () => {
    const ids = new Set(remediations.map((remediation) => remediation.id));
    const improved = assessProject(applyRemediations(sampleProject, ids)).overallScore;
    expect(improved).toBeGreaterThan(baseScore);
  });

  it("does not mutate the input project", () => {
    const before = JSON.stringify(sampleProject);
    applyRemediations(sampleProject, new Set(remediations.map((remediation) => remediation.id)));
    expect(JSON.stringify(sampleProject)).toBe(before);
  });

  it("applies no change when no remediations are selected", () => {
    const result = applyRemediations(sampleProject, new Set());
    expect(assessProject(result).overallScore).toBe(baseScore);
  });
});
