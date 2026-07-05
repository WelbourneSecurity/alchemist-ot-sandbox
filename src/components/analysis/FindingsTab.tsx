import type { Finding, SecurityAssessment, Severity } from "../../models/types";

interface FindingsTabProps {
  assessment: SecurityAssessment;
  visibleFindings: Finding[];
  hiddenFindingCount: number;
  severityOn: Record<Severity, boolean>;
  onToggleSeverity: (severity: Severity) => void;
  includeDocs: boolean;
  onIncludeDocsChange: (include: boolean) => void;
  activeFindingId: string | null;
  onFindingSelect: (finding: Finding) => void;
}

export function FindingsTab({
  assessment,
  visibleFindings,
  hiddenFindingCount,
  severityOn,
  onToggleSeverity,
  includeDocs,
  onIncludeDocsChange,
  activeFindingId,
  onFindingSelect
}: FindingsTabProps) {
  return (
    <div className="analysis-content findings-list">
      <div className="findings-filters">
        {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
          <button
            key={sev}
            type="button"
            className={`sev-chip sev-${sev}${severityOn[sev] ? " is-on" : ""}`}
            aria-pressed={severityOn[sev]}
            onClick={() => onToggleSeverity(sev)}
          >
            {sev}
          </button>
        ))}
        <label className="docs-toggle">
          <input type="checkbox" checked={includeDocs} onChange={(event) => onIncludeDocsChange(event.target.checked)} />
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
  );
}
