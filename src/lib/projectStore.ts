import { sampleProject } from "../data/sampleProject";
import { parseProjectJson, serializeProject } from "../engine/serialization";
import type { OtProject } from "../models/types";

/**
 * A small localStorage registry of named assessments: an index of metadata, a per-project payload,
 * and a pointer to the current one. The single legacy slot is migrated in on first use, so existing
 * work is never lost. Pure DOM/localStorage; the workbench reaches it through projectStorage.
 */

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

const INDEX_KEY = "alchemist-projects";
const CURRENT_KEY = "alchemist-current-project";
const PAYLOAD_PREFIX = "alchemist-project:";
const BASELINE_PREFIX = "alchemist-baseline:";
const LEGACY_KEY = "alchemist-ot-sandbox-project";

function clone(project: OtProject): OtProject {
  return JSON.parse(JSON.stringify(project)) as OtProject;
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function payloadKey(id: string): string {
  return `${PAYLOAD_PREFIX}${id}`;
}

function baselineKey(id: string): string {
  return `${BASELINE_PREFIX}${id}`;
}

function readIndex(): SavedProjectMeta[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SavedProjectMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: SavedProjectMeta[]): void {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function readPayload(id: string): OtProject | null {
  const raw = window.localStorage.getItem(payloadKey(id));
  if (!raw) {
    return null;
  }
  const parsed = parseProjectJson(raw);
  return parsed.ok ? parsed.project : null;
}

function writePayload(id: string, project: OtProject): void {
  window.localStorage.setItem(payloadKey(id), serializeProject(project));
}

function addEntry(project: OtProject): SavedProjectMeta {
  const meta: SavedProjectMeta = { id: newId(), name: project.name || "Untitled assessment", updatedAt: new Date().toISOString() };
  writePayload(meta.id, project);
  writeIndex([meta, ...readIndex()]);
  return meta;
}

/** Ensures a registry exists (migrating the legacy slot or seeding the sample) and returns the current id. */
function ensureInitialised(): string {
  const current = window.localStorage.getItem(CURRENT_KEY);
  const index = readIndex();
  if (current && index.some((meta) => meta.id === current) && readPayload(current)) {
    return current;
  }
  if (index.length > 0 && readPayload(index[0].id)) {
    window.localStorage.setItem(CURRENT_KEY, index[0].id);
    return index[0].id;
  }

  // Seed from the legacy single slot if present, otherwise the bundled sample.
  let project = clone(sampleProject);
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const parsed = parseProjectJson(legacy);
    if (parsed.ok) {
      project = parsed.project;
    }
  }
  const meta = addEntry(project);
  window.localStorage.setItem(CURRENT_KEY, meta.id);
  return meta.id;
}

export function getCurrentProjectId(): string {
  return ensureInitialised();
}

export function listProjects(): SavedProjectMeta[] {
  ensureInitialised();
  return readIndex();
}

export function getCurrentProject(): OtProject {
  const id = ensureInitialised();
  return readPayload(id) ?? clone(sampleProject);
}

/** Persists the working project into the current entry, keeping its index name and timestamp in sync. */
export function saveCurrentProject(project: OtProject): void {
  const id = ensureInitialised();
  writePayload(id, project);
  writeIndex(
    readIndex().map((meta) =>
      meta.id === id ? { ...meta, name: project.name || meta.name, updatedAt: new Date().toISOString() } : meta
    )
  );
}

export function openProject(id: string): void {
  if (readPayload(id)) {
    window.localStorage.setItem(CURRENT_KEY, id);
  }
}

/** Creates a new saved assessment from a project and makes it current; returns its id. */
export function createProject(project: OtProject): string {
  const meta = addEntry(project);
  window.localStorage.setItem(CURRENT_KEY, meta.id);
  return meta.id;
}

export function duplicateProject(id: string): string | null {
  const project = readPayload(id);
  if (!project) {
    return null;
  }
  const copy = { ...clone(project), name: `${project.name || "Assessment"} copy` };
  const meta = addEntry(copy);
  return meta.id;
}

export function renameProject(id: string, name: string): void {
  const trimmed = name.trim() || "Untitled assessment";
  writeIndex(readIndex().map((meta) => (meta.id === id ? { ...meta, name: trimmed } : meta)));
  const project = readPayload(id);
  if (project) {
    writePayload(id, { ...project, name: trimmed });
  }
}

export function deleteProject(id: string): void {
  window.localStorage.removeItem(payloadKey(id));
  window.localStorage.removeItem(baselineKey(id));
  const index = readIndex().filter((meta) => meta.id !== id);
  writeIndex(index);
  if (window.localStorage.getItem(CURRENT_KEY) === id) {
    if (index.length > 0) {
      window.localStorage.setItem(CURRENT_KEY, index[0].id);
    } else {
      window.localStorage.removeItem(CURRENT_KEY);
    }
  }
}

/** The remediation baseline snapshot for the current assessment, if one has been set. */
export function getBaseline(): OtProject | null {
  const raw = window.localStorage.getItem(baselineKey(ensureInitialised()));
  if (!raw) {
    return null;
  }
  const parsed = parseProjectJson(raw);
  return parsed.ok ? parsed.project : null;
}

export function setBaseline(project: OtProject): void {
  window.localStorage.setItem(baselineKey(ensureInitialised()), serializeProject(project));
}

export function clearBaseline(): void {
  window.localStorage.removeItem(baselineKey(ensureInitialised()));
}
