import { sampleProject } from "../data/sampleProject";
import { parseProjectJson, serializeProject } from "../engine/serialization";
import type { OtProject } from "../models/types";

/** The single current-project slot in localStorage. Shared by the workbench and the dashboard. */
export const PROJECT_STORAGE_KEY = "alchemist-ot-sandbox-project";

function cloneProject(project: OtProject): OtProject {
  return JSON.parse(JSON.stringify(project)) as OtProject;
}

/** The current project, or a copy of the bundled sample when nothing valid is stored. */
export function loadStoredProject(): OtProject {
  const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!stored) {
    return cloneProject(sampleProject);
  }
  const parsed = parseProjectJson(stored);
  return parsed.ok ? parsed.project : cloneProject(sampleProject);
}

export function writeStoredProject(project: OtProject): void {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(project));
}
