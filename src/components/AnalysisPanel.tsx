import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Crosshair,
  FileText,
  Grid2X2,
  Layers,
  ListFilter,
  Printer,
  Route,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import { useRef, useState } from "react";
import { getAssetType, getZone, zones } from "../data/catalog";
import { protocolLabel, resolveProtocolFamily } from "../data/protocols";
import type { CanvasMode, Finding, OtProject, ReachabilityResult, SecurityAssessment, Severity, ZoneId } from "../models/types";
import { assessSecurityLevels, foundationalRequirements } from "../engine/securityLevels";
import { icsTactics, icsTechniques } from "../data/attackIcs";
import { VerdictBanner } from "./VerdictBanner";

interface AnalysisPanelProps {
  project: OtProject;
  assessment: SecurityAssessment;
  reachability: ReachabilityResult;
  sourceId: string;
  targetId: string;
  canvasMode: CanvasMode;
  activeFindingId: string | null;
  onSourceChange: (id: string) => void;
  onTargetChange: (id: string) => void;
  onCanvasModeChange: (mode: CanvasMode) => void;
  onFindingSelect: (finding: Finding) => void;
  onPrintReport: () => void;
  dockHeight: number;
  onDockResize: (height: number) => void;
  dockOpen: boolean;
  onToggleDock: () => void;
  onZoneTargetChange: (zone: ZoneId, target: number) => void;
}

const DOCK_MIN = 7;
const DOCK_MAX = 42;

const TABS: Array<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: "reachability", label: "Reachability", Icon: Route },
  { id: "rating", label: "Security Rating", Icon: ShieldCheck },
  { id: "levels", label: "Security Levels", Icon: Layers },
  { id: "findings", label: "Findings", Icon: AlertTriangle },
  { id: "attack", label: "ATT&CK Exposure", Icon: Crosshair },
  { id: "flows", label: "Flow Table", Icon: ListFilter },
  { id: "matrix", label: "Zone Matrix", Icon: Grid2X2 },
  { id: "report", label: "Report", Icon: FileText }
];

type TabId = "reachability" | "rating" | "levels" | "findings" | "attack" | "flows" | "matrix" | "report";

function directionLabel(direction: string) {
  if (direction === "source-to-target") {
    return "Source to target";
  }
  if (direction === "target-to-source") {
    return "Target to source";
  }
  return "Bidirectional";
}

export function AnalysisPanel({
  project,
  assessment,
  reachability,
  sourceId,
  targetId,
  canvasMode,
  activeFindingId,
  onSourceChange,
  onTargetChange,
  onCanvasModeChange,
  onFindingSelect,
  onPrintReport,
  dockHeight,
  onDockResize,
  dockOpen,
  onToggleDock,
  onZoneTargetChange
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("reachability");
  const [includeDocs, setIncludeDocs] = useState(false);
  const [severityOn, setSeverityOn] = useState<Record<Severity, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true
  });
  const visibleFindings = assessment.findings.filter(
    (finding) => (includeDocs || finding.category !== "documentation") && severityOn[finding.severity]
  );
  const hiddenFindingCount = assessment.findings.length - visibleFindings.length;
  const securityLevels = assessSecurityLevels(project, project.zoneTargets);
  const exposedTechniques = new Set(assessment.findings.flatMap((finding) => finding.techniques ?? []));
  const assetName = (id: string) => project.assets.find((asset) => asset.id === id)?.name ?? id;
  const resizeState = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeState.current = { startY: event.clientY, startHeight: dockHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeState.current;
    if (!state) {
      return;
    }
    onDockResize(state.startHeight + (state.startY - event.clientY) / 16);
  };
  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeState.current) {
      resizeState.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onDockResize(dockHeight + 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onDockResize(dockHeight - 1);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const next = TABS[nextIndex];
    setActiveTab(next.id);
    requestAnimationFrame(() => document.getElementById(`analysis-tab-${next.id}`)?.focus());
  };

  return (
    <section className={`analysis-panel${dockOpen ? "" : " is-collapsed"}`} aria-label="Analysis">
      {dockOpen ? (
        <div
          className="dock-resize-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize analysis panel height"
          aria-valuenow={Math.round(dockHeight)}
          aria-valuemin={DOCK_MIN}
          aria-valuemax={DOCK_MAX}
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onKeyDown={handleResizeKeyDown}
        />
      ) : null}
      <div className="dock-tabs-row">
        <button
          type="button"
          className="dock-toggle"
          onClick={onToggleDock}
          aria-expanded={dockOpen}
          title={dockOpen ? "Collapse analysis" : "Expand analysis"}
        >
          {dockOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
        <div className="tabs" role="tablist" aria-label="Analysis views" onKeyDown={handleTabKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`analysis-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="analysis-tabpanel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => {
              setActiveTab(tab.id);
              if (!dockOpen) {
                onToggleDock();
              }
            }}
          >
            <tab.Icon size={16} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {dockOpen ? (
      <div
        className="analysis-panel-body"
        role="tabpanel"
        id="analysis-tabpanel"
        aria-labelledby={`analysis-tab-${activeTab}`}
        tabIndex={0}
      >
      {activeTab === "reachability" ? (
        <div className="analysis-content reachability-grid">
          <div className="query-box">
            <label>
              <span>Source</span>
              <select value={sourceId} onChange={(event) => onSourceChange(event.target.value)}>
                {project.assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Target</span>
              <select value={targetId} onChange={(event) => onTargetChange(event.target.value)}>
                {project.assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={`reachability-result ${reachability.reachable ? "reachable" : "blocked"}`}>
              <strong>{reachability.reachable ? "Reachable" : "Blocked"}</strong>
              <p>{reachability.explanation}</p>
            </div>
            <button type="button" className="text-button" onClick={() => onCanvasModeChange("reachability")}>
              Show attacker path
            </button>
            <small className="mode-note">Canvas mode: {canvasMode}</small>
          </div>
          <div className="path-box">
            <h3>Path</h3>
            {reachability.pathAssetIds.length > 0 ? (
              <ol className="path-list">
                {reachability.pathAssetIds.map((id) => (
                  <li key={id}>{assetName(id)}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">No permitted path found with the declared conduit directions.</p>
            )}
          </div>
          <div className="path-risks">
            <h3>Path risks</h3>
            {reachability.risks.length > 0 ? (
              <ul>
                {reachability.risks.map((risk, index) => (
                  <li key={`${risk.title}-${index}`} className={`severity-${risk.severity}`}>
                    <strong>{risk.title}</strong>
                    <span>{risk.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No path-specific risks detected for this query.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "rating" ? (
        <div className="analysis-content rating-stack">
          <VerdictBanner assessment={assessment} onFindingSelect={onFindingSelect} />
          <div className="category-list">
            {assessment.categoryScores.map((category) => (
              <div className="category-row" key={category.category}>
                <div>
                  <strong>{category.label}</strong>
                  <span>{category.summary}</span>
                </div>
                <div className="bar-track" aria-label={`${category.label} ${category.score} out of 100`}>
                  <span style={{ width: `${category.score}%` }} />
                </div>
                <b>{category.score}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "levels" ? (
        <div className="analysis-content sl-view">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>SL-T</th>
                <th>SL-A</th>
                <th>Gap</th>
                {foundationalRequirements.map((fr) => (
                  <th key={fr.id} title={fr.label}>
                    {fr.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {securityLevels.zones.map((zoneSL) => {
                const zoneDef = getZone(zoneSL.zone);
                const gap = zoneSL.target - zoneSL.achieved;
                return (
                  <tr key={zoneSL.zone} className={gap > 0 ? "sl-below" : ""}>
                    <th title={zoneDef.name}>{zoneDef.shortName}</th>
                    <td>
                      <select
                        className="sl-target-select"
                        value={zoneSL.target}
                        aria-label={`Target Security Level for ${zoneDef.name}`}
                        onChange={(event) => onZoneTargetChange(zoneSL.zone, Number(event.target.value))}
                      >
                        {[1, 2, 3].map((level) => (
                          <option key={level} value={level}>
                            SL {level}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={gap > 0 ? "sl-a sl-a-below" : "sl-a"}>SL {zoneSL.achieved}</td>
                    <td className="sl-gap">{gap > 0 ? `-${gap}` : "met"}</td>
                    {foundationalRequirements.map((fr) => (
                      <td
                        key={fr.id}
                        className={`fr-cell${zoneSL.limiting.includes(fr.id) && gap > 0 ? " fr-limiting" : ""}`}
                        title={`${fr.label}: SL ${zoneSL.frLevels[fr.id]}`}
                      >
                        {zoneSL.frLevels[fr.id]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">
            SL-A (achieved) is capped by the weakest Foundational Requirement (FR1–FR7); the limiting requirement(s) are
            marked. Set the target per zone — any zone below target appears as a finding. Hover a column for its name.
          </p>
        </div>
      ) : null}

      {activeTab === "findings" ? (
        <div className="analysis-content findings-list">
          <div className="findings-filters">
            {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
              <button
                key={sev}
                type="button"
                className={`sev-chip sev-${sev}${severityOn[sev] ? " is-on" : ""}`}
                aria-pressed={severityOn[sev]}
                onClick={() => setSeverityOn((current) => ({ ...current, [sev]: !current[sev] }))}
              >
                {sev}
              </button>
            ))}
            <label className="docs-toggle">
              <input type="checkbox" checked={includeDocs} onChange={(event) => setIncludeDocs(event.target.checked)} />
              Documentation gaps
            </label>
          </div>
          {visibleFindings.length > 0 ? (
            visibleFindings.map((finding) => (
              <article
                className={`finding severity-${finding.severity} ${activeFindingId === finding.id ? "active" : ""}`}
                key={finding.id}
              >
                <div>
                  <span>{finding.severity}</span>
                  <strong>{finding.title}</strong>
                </div>
                <p>{finding.detail}</p>
                <small>{finding.remediation}</small>
                <button type="button" className="text-button" onClick={() => onFindingSelect(finding)}>
                  Highlight affected conduits
                </button>
              </article>
            ))
          ) : (
            <p className="muted">
              {assessment.findings.length === 0
                ? "No findings detected in the declared model."
                : "No findings match the current filters."}
            </p>
          )}
          {hiddenFindingCount > 0 && visibleFindings.length > 0 ? (
            <p className="findings-hidden-note">
              {hiddenFindingCount} finding{hiddenFindingCount === 1 ? "" : "s"} hidden by filters.
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === "attack" ? (
        <div className="analysis-content attack-view">
          <div className="attack-matrix">
            {icsTactics.map((tactic) => {
              const techniques = icsTechniques.filter((technique) => technique.tactic === tactic.id);
              if (techniques.length === 0) {
                return null;
              }
              return (
                <div className="attack-column" key={tactic.id}>
                  <h3>{tactic.name}</h3>
                  {techniques.map((technique) => (
                    <div
                      className={`attack-tech${exposedTechniques.has(technique.id) ? " is-exposed" : ""}`}
                      key={technique.id}
                      title={`${technique.id} ${technique.name}`}
                    >
                      <span className="attack-tech-id">{technique.id}</span>
                      <span className="attack-tech-name">{technique.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="muted">
            Techniques in red are plausibly enabled by the current findings. A curated slice of MITRE ATT&amp;CK for ICS
            mapped from the assessment — not a claim of full coverage.
          </p>
        </div>
      ) : null}

      {activeTab === "flows" ? (
        <div className="analysis-content flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Direction</th>
                <th>Rule</th>
                <th>Boundary</th>
                <th>Monitoring</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {project.conduits.map((conduit) => {
                const source = project.assets.find((asset) => asset.id === conduit.source);
                const target = project.assets.find((asset) => asset.id === conduit.target);
                const family = resolveProtocolFamily(conduit);
                return (
                  <tr key={conduit.id}>
                    <td>{source?.name ?? conduit.source}</td>
                    <td>{target?.name ?? conduit.target}</td>
                    <td>
                      <span className="protocol-chip" style={{ "--protocol-color": family.color } as React.CSSProperties}>
                        {protocolLabel(conduit)}
                      </span>
                    </td>
                    <td>{directionLabel(conduit.direction)}</td>
                    <td>{conduit.firewallRule}</td>
                    <td>{conduit.trustBoundary ? "Yes" : "No"}</td>
                    <td>{[conduit.inspected ? "Inspected" : "", conduit.logged ? "Logged" : ""].filter(Boolean).join(" / ") || "Missing"}</td>
                    <td>{conduit.ruleOwner || "Unassigned"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "matrix" ? (
        <div className="analysis-content matrix-wrap">
          <table className="zone-matrix">
            <thead>
              <tr>
                <th>From / To</th>
                {zones.map((zone) => (
                  <th key={zone.id}>{zone.shortName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((sourceZone) => (
                <tr key={sourceZone.id}>
                  <th>{sourceZone.shortName}</th>
                  {zones.map((targetZone) => {
                    const flows = project.conduits.filter((conduit) => {
                      const source = project.assets.find((asset) => asset.id === conduit.source);
                      const target = project.assets.find((asset) => asset.id === conduit.target);
                      return source?.zone === sourceZone.id && target?.zone === targetZone.id;
                    });
                    return (
                      <td key={targetZone.id} className={flows.some((flow) => flow.trustBoundary) ? "has-boundary-flow" : ""}>
                        {flows.length > 0 ? flows.length : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Counts show declared conduits by source and destination zone. Boundary cells need rule, logging, and inspection review.</p>
        </div>
      ) : null}

      {activeTab === "report" ? (
        <div className="analysis-content report-preview">
          <div>
            <h3>Report preview</h3>
            <p>
              Includes the current advisory score, assumptions, top risks, reachability query, and remediation roadmap. Use the browser print dialog to
              save as PDF.
            </p>
          </div>
          <button type="button" className="text-button primary" onClick={onPrintReport}>
            <Printer size={16} />
            Print / save PDF
          </button>
          <div className="report-summary-grid">
            <span>
              <strong>{project.assets.length}</strong>
              Assets
            </span>
            <span>
              <strong>{project.conduits.length}</strong>
              Conduits
            </span>
            <span>
              <strong>{assessment.findings.length}</strong>
              Findings
            </span>
            <span>
              <strong>{project.assets.filter((asset) => getAssetType(asset.type).defaultZone === "level1").length}</strong>
              Controller types
            </span>
          </div>
        </div>
      ) : null}
      </div>
      ) : null}
    </section>
  );
}
