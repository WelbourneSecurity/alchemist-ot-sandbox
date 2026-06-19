import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { kbCategories, knowledgeBase } from "../data/knowledgeBase";

interface KnowledgeBaseProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Browsable OT reference library — frameworks, asset management, architecture and operations.
 * A two-pane modal (topic nav + article) over the static `knowledgeBase` content. Reuses the
 * shared modal-overlay styling.
 */
export function KnowledgeBase({ open, onClose }: KnowledgeBaseProps) {
  const [selectedId, setSelectedId] = useState(knowledgeBase[0].id);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const topic = knowledgeBase.find((entry) => entry.id === selectedId) ?? knowledgeBase[0];

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="knowledge-base"
        role="dialog"
        aria-modal="true"
        aria-label="OT knowledge base"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kb-head">
          <div>
            <strong>OT knowledge base</strong>
            <p>Reference for OT engineers and assessors — frameworks, asset management, architecture and operations.</p>
          </div>
          <button type="button" className="rail-collapse" onClick={onClose} title="Close" aria-label="Close knowledge base">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="kb-body">
          <nav className="kb-nav" aria-label="Topics">
            {kbCategories.map((category) => {
              const topics = knowledgeBase.filter((entry) => entry.category === category);
              if (topics.length === 0) {
                return null;
              }
              return (
                <div className="kb-nav-group" key={category}>
                  <h4>{category}</h4>
                  {topics.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className={`kb-nav-item${entry.id === selectedId ? " active" : ""}`}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      {entry.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>

          <article className="kb-article">
            <span className="kb-article-cat">{topic.category}</span>
            <h3>{topic.title}</h3>
            <p className="kb-summary">{topic.summary}</p>
            {topic.sections.map((section) => (
              <section key={section.heading}>
                <h4>{section.heading}</h4>
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="kb-refs">
              <h4>References</h4>
              <div className="kb-ref-chips">
                {topic.references.map((reference) => (
                  <span key={reference}>{reference}</span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
