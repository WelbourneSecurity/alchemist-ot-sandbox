import { getZone } from "../../data/catalog";
import { foundationalRequirements, type SecurityLevelAssessment } from "../../engine/securityLevels";
import type { ZoneId } from "../../models/types";

interface LevelsTabProps {
  securityLevels: SecurityLevelAssessment;
  onZoneTargetChange: (zone: ZoneId, target: number) => void;
}

export function LevelsTab({ securityLevels, onZoneTargetChange }: LevelsTabProps) {
  return (
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
  );
}
