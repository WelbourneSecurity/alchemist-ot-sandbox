import { AlertTriangle, FileText, Grid2X2, ListFilter, Printer, Route, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { getAssetType, getZone, zones } from "../data/catalog";
import { protocolLabel, resolveProtocolFamily } from "../data/protocols";
import type { CanvasMode, Finding, OtProject, ReachabilityResult, SecurityAssessment } from "../models/types";
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
}

const DOCK_MIN = 7;
const DOCK_MAX = 42;

type TabId = "reachability" | "rating" | "findings" | "flows" | "matrix" | "report";

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
  onDockResize
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("reachability");
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

  return (
    <section className="analysis-panel" aria-label="Analysis">
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
      <div className="tabs" role="tablist" aria-label="Analysis views">
        <button className={activeTab === "reachability" ? "active" : ""} onClick={() => setActiveTab("reachability")}>
          <Route size={16} />
          Reachability
        </button>
        <button className={activeTab === "rating" ? "active" : ""} onClick={() => setActiveTab("rating")}>
          <ShieldCheck size={16} />
          Security Rating
        </button>
        <button className={activeTab === "findings" ? "active" : ""} onClick={() => setActiveTab("findings")}>
          <AlertTriangle size={16} />
          Findings
        </button>
        <button className={activeTab === "flows" ? "active" : ""} onClick={() => setActiveTab("flows")}>
          <ListFilter size={16} />
          Flow Table
        </button>
        <button className={activeTab === "matrix" ? "active" : ""} onClick={() => setActiveTab("matrix")}>
          <Grid2X2 size={16} />
          Zone Matrix
        </button>
        <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")}>
          <FileText size={16} />
          Report
        </button>
      </div>

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

      {activeTab === "findings" ? (
        <div className="analysis-content findings-list">
          {assessment.findings.length > 0 ? (
            assessment.findings.slice(0, 12).map((finding) => (
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
            <p className="muted">No findings detected in the declared model.</p>
          )}
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
    </section>
  );
}
