import { getAssetType, getZone, standardReferences } from "../data/catalog";
import type { OtProject, ReachabilityResult, SecurityAssessment } from "../models/types";

interface PrintableReportProps {
  project: OtProject;
  assessment: SecurityAssessment;
  reachability: ReachabilityResult;
}

export function PrintableReport({ project, assessment, reachability }: PrintableReportProps) {
  const assetName = (id: string) => project.assets.find((asset) => asset.id === id)?.name ?? id;

  return (
    <article className="print-document">
      <header>
        <p>Alchemist OT Sandbox</p>
        <h1>{project.name}</h1>
        <strong>Advisory score: {assessment.overallScore}/100</strong>
        <span>Generated {new Date(project.updatedAt).toLocaleString()}</span>
      </header>

      <section>
        <h2>Executive Summary</h2>
        <p>
          This browser-local assessment reviews the declared OT topology, Purdue zones, conduits, and controls. It is an architectural advisory score
          and is not certification against ISA/IEC 62443 or any other standard.
        </p>
        <div className="print-metrics">
          <span>{project.assets.length} assets</span>
          <span>{project.conduits.length} conduits</span>
          <span>{assessment.findings.length} findings</span>
          <span>{assessment.band} posture</span>
        </div>
      </section>

      <section>
        <h2>Reachability Query</h2>
        <p>
          {assetName(reachability.sourceId)} to {assetName(reachability.targetId)}:{" "}
          <strong>{reachability.reachable ? "reachable" : "blocked"}</strong>
        </p>
        <p>{reachability.explanation}</p>
        {reachability.pathAssetIds.length > 0 ? <p>Path: {reachability.pathAssetIds.map(assetName).join(" -> ")}</p> : null}
      </section>

      <section>
        <h2>Rating Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Score</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {assessment.categoryScores.map((category) => (
              <tr key={category.category}>
                <td>{category.label}</td>
                <td>{category.score}</td>
                <td>{category.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Top Remediation Actions</h2>
        {assessment.findings.slice(0, 10).map((finding) => (
          <div className="print-finding" key={finding.id}>
            <strong>
              {finding.severity.toUpperCase()} - {finding.title}
            </strong>
            <p>{finding.detail}</p>
            <p>{finding.remediation}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Asset Inventory</h2>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Zone</th>
              <th>Criticality</th>
              <th>Protocols</th>
            </tr>
          </thead>
          <tbody>
            {project.assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.name}</td>
                <td>{getAssetType(asset.type).label}</td>
                <td>{getZone(asset.zone).levelLabel}</td>
                <td>{asset.criticality}</td>
                <td>{asset.protocols.join(", ") || "Not documented"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Assumptions and References</h2>
        <ul>
          {project.assumptions.map((assumption) => (
            <li key={assumption.id}>{assumption.label}</li>
          ))}
          {Object.values(standardReferences).map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
