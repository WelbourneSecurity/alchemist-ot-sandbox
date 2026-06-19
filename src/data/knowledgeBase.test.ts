import { describe, expect, it } from "vitest";
import { kbCategories, knowledgeBase } from "./knowledgeBase";

describe("knowledgeBase", () => {
  it("has unique topic ids", () => {
    const ids = knowledgeBase.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every topic is complete and uses a known category", () => {
    for (const topic of knowledgeBase) {
      expect(topic.title.length).toBeGreaterThan(0);
      expect(topic.summary.length).toBeGreaterThan(0);
      expect(kbCategories).toContain(topic.category);
      expect(topic.sections.length).toBeGreaterThan(0);
      expect(topic.references.length).toBeGreaterThan(0);
      for (const section of topic.sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.points.length).toBeGreaterThan(0);
      }
    }
  });

  it("covers the requested core OT topics", () => {
    const ids = new Set(knowledgeBase.map((topic) => topic.id));
    for (const id of ["asset-registers", "iec-62443", "nist-csf-2", "nist-800-82"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
