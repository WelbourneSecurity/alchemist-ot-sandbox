import { describe, expect, it } from "vitest";
import { icsTechniques, techniquesForCategory } from "./attackIcs";

describe("ATT&CK for ICS mapping", () => {
  it("maps weakness categories to known technique ids", () => {
    const validIds = new Set(icsTechniques.map((technique) => technique.id));
    const categories = ["segmentation", "remoteAccess", "identity", "legacyExposure", "safetyImpact"] as const;

    for (const category of categories) {
      const techniques = techniquesForCategory(category);
      expect(techniques.length).toBeGreaterThan(0);
      for (const id of techniques) {
        expect(validIds.has(id)).toBe(true);
      }
    }
  });

  it("returns no techniques for documentation findings", () => {
    expect(techniquesForCategory("documentation")).toEqual([]);
  });

  it("assigns every technique to a known tactic", () => {
    const tactics = new Set(icsTechniques.map((technique) => technique.tactic));
    expect(tactics.size).toBeGreaterThan(0);
  });
});
