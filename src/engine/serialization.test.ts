import { describe, expect, it } from "vitest";
import { sampleProject } from "../data/sampleProject";
import { parseProjectJson, serializeProject } from "./serialization";

describe("project serialization", () => {
  it("round-trips a valid project", () => {
    const result = parseProjectJson(serializeProject(sampleProject));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.assets.length).toBe(sampleProject.assets.length);
      expect(result.project.conduits.length).toBe(sampleProject.conduits.length);
    }
  });

  it("rejects conduits that reference missing assets", () => {
    const invalid = {
      ...sampleProject,
      conduits: [{ ...sampleProject.conduits[0], source: "missing" }]
    };
    const result = parseProjectJson(JSON.stringify(invalid));

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing");
  });

  it("migrates schema version 1 projects to the current local schema", () => {
    const legacy = JSON.parse(serializeProject(sampleProject));
    legacy.schemaVersion = 1;
    delete legacy.assets[0].manufacturer;
    delete legacy.assets[0].backupStatus;
    delete legacy.conduits[0].protocolFamily;
    delete legacy.conduits[0].ruleOwner;

    const result = parseProjectJson(JSON.stringify(legacy));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.schemaVersion).toBe(2);
      expect(result.project.assets[0].manufacturer).toBe("");
      expect(result.project.assets[0].backupStatus).toBe("unknown");
      expect(result.project.conduits[0].protocolFamily).toBe("auto");
      expect(result.project.conduits[0].ruleOwner).toBe("");
    }
  });
});
