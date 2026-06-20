import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FilePlus2,
  Flame,
  Layers,
  LayoutGrid,
  Moon,
  Scale,
  ScrollText,
  Sun,
  Waypoints
} from "lucide-react";
import { VerdictBanner } from "./VerdictBanner";
import { assessProject } from "../engine/scoring";
import { assessSecurityLevels } from "../engine/securityLevels";
import { assessRisk } from "../engine/risk";
import { assessCaf } from "../engine/caf";
import { analyzeAttackPath, suggestEntry, suggestTarget } from "../engine/attackPath";
import { loadStoredProject, writeStoredProject } from "../lib/projectStorage";
import { blankProject } from "../data/sampleProject";
import { scenarios } from "../data/scenarios";
import type { OtProject } from "../models/types";

export type DashboardIntent = "reference" | "methodology";

interface DashboardProps {
  onEnter: (intent?: DashboardIntent) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

/**
 * The home view and front door: a read-only posture overview of the current stored project, reusing
 * the assessment engines and the VerdictBanner hero, with a scenario picker and entry CTAs into the
 * workbench. Loading a scenario writes it to storage; the workbench reads the same slot on entry.
 */
export function Dashboard({ onEnter, theme, onToggleTheme }: DashboardProps) {
  const [project] = useState<OtProject>(() => loadStoredProject());

  const assessment = assessProject(project);
  const securityLevels = assessSecurityLevels(project, project.zoneTargets);
  const risk = assessRisk(project, assessment.findings);
  const caf = assessCaf(project, assessment, securityLevels, risk);
  const entryId = suggestEntry(project);
  const attackPath = analyzeAttackPath(project, entryId, suggestTarget(project, entryId), assessment.findings);

  const assetName = (id: string) => project.assets.find((asset) => asset.id === id)?.name ?? id;
  const slGaps = securityLevels.zones.filter((zone) => zone.achieved < zone.target).length;
  const highRisk = risk.assets.filter((asset) => asset.band === "critical" || asset.band === "high").length;

  const load = (next: OtProject) => {
    writeStoredProject(next);
    onEnter();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-top">
        <div className="dashboard-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" focusable="false">
              <circle cx="24" cy="24" r="18" className="brand-mark-ring" />
              <circle cx="24" cy="24" r="11" className="brand-mark-ring" />
              <path d="M24 6 V42" className="brand-mark-grid" />
              <path d="M6 24 H42" className="brand-mark-grid" />
              <circle cx="24" cy="24" r="3.2" className="brand-mark-core" />
              <path d="M24 6 A18 18 0 0 1 42 24" className="brand-mark-sweep" />
            </svg>
          </span>
          <div>
            <strong>Alchemist</strong>
            <span>OT security workbench</span>
          </div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle light and dark mode"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <section className="dashboard-hero">
        <div className="dashboard-hero-main">
          <p className="dashboard-eyebrow">Current assessment</p>
          <h1>{project.name}</h1>
          <VerdictBanner assessment={assessment} />
          <div className="dashboard-cta">
            <button type="button" className="text-button primary" onClick={() => onEnter()}>
              Open workbench
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="text-button" onClick={() => load(blankProject)}>
              <FilePlus2 size={15} aria-hidden="true" />
              New blank
            </button>
          </div>
        </div>
        <aside className="dashboard-stats" aria-label="Model size">
          <div className="dash-stat">
            <span>Assets</span>
            <strong>{project.assets.length}</strong>
          </div>
          <div className="dash-stat">
            <span>Conduits</span>
            <strong>{project.conduits.length}</strong>
          </div>
          <div className="dash-stat">
            <span>Findings</span>
            <strong>{assessment.findings.length}</strong>
          </div>
        </aside>
      </section>

      <section className="dashboard-tiles" aria-label="Posture overview">
        <article className="dash-tile">
          <Layers size={18} aria-hidden="true" />
          <span>IEC 62443 SL</span>
          <strong>{slGaps}</strong>
          <small>{slGaps === 1 ? "zone below target" : "zones below target"}</small>
        </article>
        <article className="dash-tile">
          <Scale size={18} aria-hidden="true" />
          <span>NCSC CAF</span>
          <strong>{caf.postureScore}%</strong>
          <small>advisory posture</small>
        </article>
        <article className="dash-tile">
          <Flame size={18} aria-hidden="true" />
          <span>High / critical risk</span>
          <strong>{highRisk}</strong>
          <small>{highRisk === 1 ? "asset" : "assets"}</small>
        </article>
        <article className="dash-tile dash-tile-wide">
          <Waypoints size={18} aria-hidden="true" />
          <span>Attack path</span>
          <strong>
            {attackPath.reachable ? `${assetName(attackPath.entryId)} to ${assetName(attackPath.targetId)}` : "Contained"}
          </strong>
          <small>
            {attackPath.reachable
              ? `crown-jewel consequence ${attackPath.consequence.value}/5`
              : "no path to a crown jewel"}
          </small>
        </article>
      </section>

      <section className="dashboard-scenarios">
        <h2>Load a sector scenario</h2>
        <div className="dashboard-scenario-grid">
          {scenarios.map((scenario) => (
            <button
              type="button"
              key={scenario.id}
              className="dashboard-scenario"
              onClick={() => load(scenario.project)}
            >
              <strong>{scenario.sector}</strong>
              <span>{scenario.name}</span>
              <p>{scenario.summary}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-links" aria-label="Learn">
        <button type="button" className="text-button" onClick={() => onEnter("reference")}>
          <BookOpen size={15} aria-hidden="true" />
          Reference library
        </button>
        <button type="button" className="text-button" onClick={() => onEnter("methodology")}>
          <ScrollText size={15} aria-hidden="true" />
          How it assesses
        </button>
        <button type="button" className="text-button" onClick={() => onEnter()}>
          <LayoutGrid size={15} aria-hidden="true" />
          Open workbench
        </button>
      </section>

      <footer className="dashboard-footer">
        <span>Browser-local · advisory only · not a substitute for a formal assessment.</span>
        <a href="https://welbournesecurity.com" target="_blank" rel="noopener noreferrer">
          welbournesecurity.com
        </a>
      </footer>
    </div>
  );
}
