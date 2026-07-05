import { icsTactics, icsTechniques } from "../../data/attackIcs";

interface AttackMatrixTabProps {
  exposedTechniques: ReadonlySet<string>;
}

export function AttackMatrixTab({ exposedTechniques }: AttackMatrixTabProps) {
  return (
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
  );
}
