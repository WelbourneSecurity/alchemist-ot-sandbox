import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  FileText,
  Flame,
  Grid2X2,
  Layers,
  ListFilter,
  Printer,
  Route,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAssetType, getZone, zones } from "../data/catalog";
import { cafObjectives, cafPrinciplesForObjective } from "../data/caf";
import { protocolLabel, resolveProtocolFamily } from "../data/protocols";
import type {
  CafPrincipleId,
  CafStatus,
  CanvasMode,
  Finding,
  OtProject,
  ReachabilityResult,
  RiskTreatment,
  RiskTreatmentDecision,
  SecurityAssessment,
  Severity,
  ZoneId
} from "../models/types";
import { assessSecurityLevels, foundationalRequirements } from "../engine/securityLevels";
import { assessCaf } from "../engine/caf";
import { icsTactics, icsTechniques } from "../data/attackIcs";
import { RISK_SCALE, assessRisk, countHighRisk, riskBand } from "../engine/risk";
import { analyzeAttackPath, suggestEntry, suggestTarget } from "../engine/attackPath";
import { diffAssessments } from "../engine/baselineDiff";
import { assessProject } from "../engine/scoring";
import { applyRemediations, remediations } from "../engine/remediations";
import { clearBaseline, getBaseline, setBaseline } from "../lib/projectStore";
import { VerdictBanner } from "./VerdictBanner";

const CAF_STATUS_LABEL: Record<CafStatus, string> = {
  achieved: "Achieved",
  partial: "Partially",
  "not-achieved": "Not Achieved",
  "not-assessed": "Not Assessed"
};

const TREATMENT_LABEL: Record<RiskTreatmentDecision, string> = {
  mitigate: "Mitigate",
  accept: "Accept",
  transfer: "Transfer",
  avoid: "Avoid"
};

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
  onCafOverrideChange: (principle: CafPrincipleId, status: CafStatus | null) => void;
  onRiskTreatmentChange: (assetId: string, patch: Partial<RiskTreatment>) => void;
  onEditGovernance: () => void;
  onApplyProject: (project: OtProject) => void;
}

const DOCK_MIN = 7;
const DOCK_MAX = 42;

const TAB_GROUPS: Array<{ label: string; tabs: Array<{ id: TabId; label: string; Icon: LucideIcon }> }> = [
  {
    label: "Posture",
    tabs: [
      { id: "rating", label: "Security Rating", Icon: ShieldCheck },
      { id: "levels", label: "Security Levels", Icon: Layers },
      { id: "compliance", label: "Compliance (CAF)", Icon: Scale },
      { id: "risk", label: "Risk", Icon: Flame },
      { id: "findings", label: "Findings", Icon: AlertTriangle }
    ]
  },
  {
    label: "Improve",
    tabs: [
      { id: "baseline", label: "Baseline", Icon: TrendingUp },
      { id: "whatif", label: "What-if", Icon: SlidersHorizontal }
    ]
  },
  {
    label: "Threat",
    tabs: [
      { id: "attackpath", label: "Attack Path", Icon: Waypoints },
      { id: "attack", label: "ATT&CK Exposure", Icon: Crosshair }
    ]
  },
  {
    label: "Network",
    tabs: [
      { id: "reachability", label: "Reachability", Icon: Route },
      { id: "flows", label: "Flow Table", Icon: ListFilter },
      { id: "matrix", label: "Zone Matrix", Icon: Grid2X2 }
    ]
  },
  {
    label: "Report",
    tabs: [{ id: "report", label: "Report", Icon: FileText }]
  }
];

const TABS = TAB_GROUPS.flatMap((group) => group.tabs);

type TabId =
  | "reachability"
  | "attackpath"
  | "rating"
  | "levels"
  | "compliance"
  | "findings"
  | "baseline"
  | "whatif"
  | "attack"
  | "risk"
  | "flows"
  | "matrix"
  | "report";

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
  onZoneTargetChange,
  onCafOverrideChange,
  onRiskTreatmentChange,
  onEditGovernance,
  onApplyProject
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("rating");
  const [includeDocs, setIncludeDocs] = useState(false);
  const [severityOn, setSeverityOn] = useState<Record<Severity, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true
  });
  const [attackEntryOverride, setAttackEntryOverride] = useState<string | null>(null);
  const [attackTargetOverride, setAttackTargetOverride] = useState<string | null>(null);
  const [baselineProject, setBaselineProject] = useState(() => getBaseline());
  const [activeRemediations, setActiveRemediations] = useState<Set<string>>(() => new Set());

  // Re-read the baseline when the active assessment changes (e.g. switching projects).
  useEffect(() => {
    setBaselineProject(getBaseline());
  }, [project.id]);
  const visibleFindings = assessment.findings.filter(
    (finding) => (includeDocs || finding.category !== "documentation") && severityOn[finding.severity]
  );
  const hiddenFindingCount = assessment.findings.length - visibleFindings.length;
  const securityLevels = assessSecurityLevels(project, project.zoneTargets);
  const exposedTechniques = new Set(assessment.findings.flatMap((finding) => finding.techniques ?? []));
  const risk = assessRisk(project, assessment.findings);
  const caf = assessCaf(project, assessment, securityLevels, risk);
  const findingById = new Map(assessment.findings.map((finding) => [finding.id, finding]));
  const assetName = (id: string) => project.assets.find((asset) => asset.id === id)?.name ?? id;
  const assetExists = (id: string | null): id is string => Boolean(id) && project.assets.some((asset) => asset.id === id);
  const attackEntryId = assetExists(attackEntryOverride) ? attackEntryOverride : suggestEntry(project);
  const attackTargetId = assetExists(attackTargetOverride) ? attackTargetOverride : suggestTarget(project, attackEntryId);
  const attackPath = analyzeAttackPath(project, attackEntryId, attackTargetId, assessment.findings);

  const captureBaseline = () => {
    setBaseline(project);
    setBaselineProject(getBaseline());
  };
  const dropBaseline = () => {
    clearBaseline();
    setBaselineProject(null);
  };
  const baselineDiff = baselineProject && activeTab === "baseline" ? diffAssessments(baselineProject, project) : null;

  const simulated = activeTab === "whatif" ? applyRemediations(project, activeRemediations) : project;
  const simAssessment = activeTab === "whatif" ? assessProject(simulated) : assessment;
  const simRisk = activeTab === "whatif" ? assessRisk(simulated, simAssessment.findings) : risk;
  const currentHighRisk = countHighRisk(risk);
  const simHighRisk = countHighRisk(simRisk);
  const simScoreDelta = simAssessment.overallScore - assessment.overallScore;
  const toggleRemediation = (id: string) => {
    setActiveRemediations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
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
          {TAB_GROUPS.map((group) => (
            <div className="tab-group" key={group.label}>
              <span className="tab-group-label" aria-hidden="true">
                {group.label}
              </span>
              {group.tabs.map((tab) => (
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

      {activeTab === "attackpath" ? (
        <div className="analysis-content reachability-grid">
          <div className="query-box">
            <label>
              <span>Entry point</span>
              <select value={attackEntryId} onChange={(event) => setAttackEntryOverride(event.target.value)}>
                {project.assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Crown jewel</span>
              <select value={attackTargetId} onChange={(event) => setAttackTargetOverride(event.target.value)}>
                {project.assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={`reachability-result ${attackPath.reachable ? "reachable" : "blocked"}`}>
              <strong>{attackPath.reachable ? "Path found" : "No path"}</strong>
              <p>{attackPath.explanation}</p>
            </div>
            <small className="mode-note">
              Consequence {attackPath.consequence.value}/{RISK_SCALE}
              {attackPath.consequence.processTag ? ` · ${attackPath.consequence.processTag}` : ""}
            </small>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onSourceChange(attackEntryId);
                onTargetChange(attackTargetId);
                onCanvasModeChange("reachability");
              }}
            >
              Show on canvas
            </button>
          </div>

          <div className="path-box">
            <h3>Kill chain</h3>
            {attackPath.reachable ? (
              <>
                <ol className="path-list">
                  {attackPath.hops.map((hop) => (
                    <li key={hop.assetId} title={`${hop.typeLabel} · ${hop.zoneLabel}`}>
                      {hop.name}
                    </li>
                  ))}
                </ol>
                <ul className="killchain">
                  {attackPath.tactics.map((tactic) => (
                    <li key={tactic.id}>
                      <strong>{tactic.name}</strong>
                      <span>{tactic.techniques.map((technique) => `${technique.id} ${technique.name}`).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">{attackPath.explanation}</p>
            )}
          </div>

          <div className="path-risks">
            <h3>Break the chain</h3>
            {attackPath.breakers.length > 0 ? (
              <ul>
                {attackPath.breakers.map((breaker, index) => (
                  <li key={index}>
                    <span>{breaker}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No path-specific controls to add; the route is already constrained.</p>
            )}
            {attackPath.protectedAssets.length > 0 ? (
              <>
                <h3>Protected (defence in depth)</h3>
                <p className="muted">Unreachable from the entry: {attackPath.protectedAssets.join(", ")}.</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "baseline" ? (
        <div className="analysis-content baseline-view">
          {baselineProject && baselineDiff ? (
            <>
              <div className="baseline-summary">
                <div className="baseline-score">
                  <span>Baseline</span>
                  <strong>{baselineDiff.baselineScore}</strong>
                </div>
                <div className="baseline-score">
                  <span>Current</span>
                  <strong>{baselineDiff.currentScore}</strong>
                </div>
                <div className={`baseline-delta ${baselineDiff.scoreDelta >= 0 ? "is-up" : "is-down"}`}>
                  <span>Change</span>
                  <strong>{baselineDiff.scoreDelta >= 0 ? `+${baselineDiff.scoreDelta}` : baselineDiff.scoreDelta}</strong>
                </div>
                <div className="baseline-score">
                  <span>High / critical risk</span>
                  <strong>
                    {baselineDiff.baselineHighRisk} to {baselineDiff.currentHighRisk}
                  </strong>
                </div>
                <div className="baseline-summary-actions">
                  <button type="button" className="text-button" onClick={captureBaseline} title="Snapshot the current model as the new baseline">
                    Update baseline
                  </button>
                  <button type="button" className="text-button" onClick={dropBaseline}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="baseline-cols">
                <div>
                  <h3>Category change</h3>
                  <div className="kb-table-wrap">
                    <table className="kb-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Base</th>
                          <th>Now</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baselineDiff.categories.map((row) => (
                          <tr key={row.category}>
                            <td>{row.label}</td>
                            <td>{row.baseline}</td>
                            <td>{row.current}</td>
                            <td className={row.delta > 0 ? "delta-up" : row.delta < 0 ? "delta-down" : ""}>
                              {row.delta > 0 ? `+${row.delta}` : row.delta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3>Fixed since baseline ({baselineDiff.fixed.length})</h3>
                  {baselineDiff.fixed.length > 0 ? (
                    <ul className="baseline-findings">
                      {baselineDiff.fixed.map((finding) => (
                        <li key={finding.id} className="is-fixed">
                          <span>{finding.severity}</span>
                          {finding.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No findings cleared yet.</p>
                  )}
                  <h3>Introduced ({baselineDiff.introduced.length})</h3>
                  {baselineDiff.introduced.length > 0 ? (
                    <ul className="baseline-findings">
                      {baselineDiff.introduced.map((finding) => (
                        <li key={finding.id} className="is-introduced">
                          <span>{finding.severity}</span>
                          {finding.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No new findings introduced.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="baseline-empty">
              <p>
                Snapshot the current model as a baseline, then remediate and watch the score, risk and findings
                improve against it.
              </p>
              <button type="button" className="text-button primary" onClick={captureBaseline}>
                Set baseline from current
              </button>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "whatif" ? (
        <div className="analysis-content whatif-view">
          <div className="baseline-summary">
            <div className="baseline-score">
              <span>Now</span>
              <strong>{assessment.overallScore}</strong>
            </div>
            <div className="baseline-score">
              <span>Simulated</span>
              <strong>{simAssessment.overallScore}</strong>
            </div>
            <div className={`baseline-delta ${simScoreDelta >= 0 ? "is-up" : "is-down"}`}>
              <span>Change</span>
              <strong>{simScoreDelta >= 0 ? `+${simScoreDelta}` : simScoreDelta}</strong>
            </div>
            <div className="baseline-score">
              <span>High / critical risk</span>
              <strong>
                {currentHighRisk} to {simHighRisk}
              </strong>
            </div>
            <div className="baseline-summary-actions">
              <button
                type="button"
                className="text-button primary"
                disabled={activeRemediations.size === 0}
                onClick={() => {
                  onApplyProject(simulated);
                  setActiveRemediations(new Set());
                }}
                title="Commit the simulated remediations to the model"
              >
                Apply to model
              </button>
              <button
                type="button"
                className="text-button"
                disabled={activeRemediations.size === 0}
                onClick={() => setActiveRemediations(new Set())}
              >
                Reset
              </button>
            </div>
          </div>
          <ul className="whatif-list">
            {remediations.map((remediation) => {
              const on = activeRemediations.has(remediation.id);
              return (
                <li key={remediation.id}>
                  <button
                    type="button"
                    className={`whatif-toggle${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleRemediation(remediation.id)}
                  >
                    <span className="whatif-check">{on ? <Check size={14} aria-hidden="true" /> : null}</span>
                    <span className="whatif-text">
                      <strong>{remediation.label}</strong>
                      <small>{remediation.description}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
            marked. Set the target per zone; any zone below target appears as a finding. Hover a column for its name.
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

      {activeTab === "compliance" ? (
        <div className="analysis-content caf-view">
          <div className="caf-head">
            <div className="caf-posture">
              <strong>{caf.postureScore}%</strong>
              <span>CAF readiness · assessed outcomes</span>
            </div>
            <div className="caf-objective-summary">
              {caf.objectives.map((objective) => {
                const meta = cafObjectives.find((item) => item.id === objective.id);
                return (
                  <div className="caf-objective-pill" key={objective.id} title={meta?.title}>
                    <strong>{objective.id}</strong>
                    <span>
                      {objective.achieved}A · {objective.partial}P · {objective.notAchieved}N
                      {objective.notAssessed > 0 ? ` · ${objective.notAssessed}?` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="text-button compact" onClick={onEditGovernance}>
              <Building2 size={14} aria-hidden="true" />
              Engagement context
            </button>
          </div>

          {cafObjectives.map((objective) => (
            <div className="caf-objective-group" key={objective.id}>
              <h3>
                {objective.id} · {objective.title}
              </h3>
              <div className="caf-principles">
                {cafPrinciplesForObjective(objective.id).map((principle) => {
                  const result = caf.principles.find((item) => item.id === principle.id);
                  if (!result) {
                    return null;
                  }
                  return (
                    <details className="caf-principle" key={principle.id}>
                      <summary>
                        <span className="caf-code">{principle.id}</span>
                        <span className="caf-title">{principle.title}</span>
                        <span className={`caf-status caf-status-${result.status}`}>{CAF_STATUS_LABEL[result.status]}</span>
                      </summary>
                      <div className="caf-principle-body">
                        <p className="caf-rationale">{result.rationale}</p>
                        {result.gap ? (
                          <p className="caf-gap">
                            <strong>Gap:</strong> {result.gap}
                          </p>
                        ) : null}
                        <p className="caf-guidance">{principle.otGuidance}</p>
                        {result.findingIds.length > 0 ? (
                          <div className="caf-findings">
                            {result.findingIds.map((findingId) => {
                              const finding = findingById.get(findingId);
                              return finding ? (
                                <button
                                  type="button"
                                  key={findingId}
                                  className="caf-finding-link"
                                  onClick={() => onFindingSelect(finding)}
                                >
                                  {finding.title}
                                </button>
                              ) : null;
                            })}
                          </div>
                        ) : null}
                        <label className="caf-override field">
                          <span>Assessor status</span>
                          <select
                            value={result.overridden ? result.status : ""}
                            onChange={(event) =>
                              onCafOverrideChange(principle.id, (event.target.value || null) as CafStatus | null)
                            }
                          >
                            <option value="">Use derived ({CAF_STATUS_LABEL[result.derivedStatus]})</option>
                            {(Object.keys(CAF_STATUS_LABEL) as CafStatus[]).map((status) => (
                              <option key={status} value={status}>
                                {CAF_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <small className="caf-refs">{principle.references.join(" · ")}</small>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))}
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
            mapped from the assessment, not a claim of full coverage.
          </p>
        </div>
      ) : null}

      {activeTab === "risk" ? (
        <div className="analysis-content risk-view">
          <div className="risk-heatmap">
            <div className="risk-grid">
              {Array.from({ length: RISK_SCALE * RISK_SCALE }, (_, index) => {
                const consequence = RISK_SCALE - Math.floor(index / RISK_SCALE);
                const likelihood = (index % RISK_SCALE) + 1;
                const count = risk.matrix[consequence - 1][likelihood - 1];
                const band = riskBand(consequence * likelihood);
                return (
                  <div
                    className={`risk-cell risk-cell-${band}`}
                    key={index}
                    title={`Consequence ${consequence} × Likelihood ${likelihood} = ${consequence * likelihood} (${band})`}
                  >
                    {count > 0 ? count : ""}
                  </div>
                );
              })}
            </div>
            <p className="muted risk-axes">Rows: consequence (top = severe) · Columns: likelihood (right = likely)</p>
          </div>
          <div className="risk-register">
            <h3>Risk register &amp; treatment</h3>
            <table className="risk-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th title="Consequence">C</th>
                  <th title="Likelihood">L</th>
                  <th>Score</th>
                  <th>Band</th>
                  <th>Treatment</th>
                  <th>Owner</th>
                  <th>Target</th>
                  <th title="Residual score after treatment">Resid.</th>
                </tr>
              </thead>
              <tbody>
                {risk.assets.slice(0, 12).map((item) => {
                  const treatment = project.riskTreatments?.[item.assetId];
                  return (
                    <tr key={item.assetId}>
                      <th>{assetName(item.assetId)}</th>
                      <td>{item.consequence}</td>
                      <td>{item.likelihood}</td>
                      <td>{item.score}</td>
                      <td>
                        <span className={`risk-band-chip risk-chip-${item.band}`}>{item.band}</span>
                      </td>
                      <td>
                        <select
                          className="treatment-select"
                          aria-label={`Treatment for ${assetName(item.assetId)}`}
                          value={treatment?.decision ?? ""}
                          onChange={(event) => {
                            if (event.target.value) {
                              onRiskTreatmentChange(item.assetId, { decision: event.target.value as RiskTreatmentDecision });
                            }
                          }}
                        >
                          <option value="" disabled>
                            Set…
                          </option>
                          {(Object.keys(TREATMENT_LABEL) as RiskTreatmentDecision[]).map((decision) => (
                            <option key={decision} value={decision}>
                              {TREATMENT_LABEL[decision]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="treatment-input"
                          aria-label={`Risk owner for ${assetName(item.assetId)}`}
                          value={treatment?.owner ?? ""}
                          placeholder="Owner"
                          onChange={(event) => onRiskTreatmentChange(item.assetId, { owner: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="treatment-input"
                          type="date"
                          aria-label={`Target date for ${assetName(item.assetId)}`}
                          value={treatment?.targetDate ?? ""}
                          onChange={(event) => onRiskTreatmentChange(item.assetId, { targetDate: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="treatment-input treatment-residual"
                          type="number"
                          min={1}
                          max={25}
                          aria-label={`Residual score for ${assetName(item.assetId)}`}
                          value={treatment?.residual ?? ""}
                          onChange={(event) =>
                            onRiskTreatmentChange(item.assetId, {
                              residual: event.target.value === "" ? undefined : Number(event.target.value)
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
