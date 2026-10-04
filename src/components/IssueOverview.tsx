import { useId, useState } from "react";
import type { ReviewTarget } from "../lib/evidence";
import type { Product } from "../lib/types";
import { groupIssues, issueColor, issueTextColor } from "../lib/issueClasses";
import { IssueBar } from "./IssueBar";

export function IssueOverview({ targets, products, onSelect }: {
  targets: ReviewTarget[];
  products: Product[];
  onSelect: (target: ReviewTarget) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const listId = useId();
  const groups = groupIssues(targets);
  const active = groups.find((group) => group.key === expanded);
  const toggle = (key: string) => setExpanded((current) => current === key ? null : key);
  if (!targets.length) return null;
  return (
    <section className="issue-overview" aria-label="Issues to resolve">
      <IssueBar targets={targets} onSelectClass={toggle} expandedClass={expanded} controlsId={listId} />
      <div className="issue-key">
        {groups.map((group) => (
          <button
            className="issue-key-entry"
            key={group.key}
            style={{ color: issueTextColor(group.hue) }}
            aria-expanded={expanded === group.key}
            aria-controls={listId}
            onClick={() => toggle(group.key)}
          >
            <strong>{group.count}</strong> {group.label}
          </button>
        ))}
      </div>
      <div id={listId} hidden={!active}>
        {active && (
          <ul className="expanded-issues" aria-label={active.label} style={{ borderTopColor: issueColor(active.hue) }}>
            {active.targets.map((target) => {
              const product = products.find((item) => item.id === target.productId);
              return (
                <li key={target.id}>
                  <button onClick={() => onSelect(target)}>
                    <span className="expanded-issue-part">
                      <strong>{product?.description}</strong>
                      <small>{product?.partNumber}</small>
                    </span>
                    <span className="expanded-issue-label" style={{ color: issueTextColor(active.hue) }}>{target.label} <span aria-hidden="true">→</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
