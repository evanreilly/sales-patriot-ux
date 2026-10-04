import type { ReviewTarget } from "../lib/evidence";
import { groupIssues, issueColor } from "../lib/issueClasses";

export function IssueBar({
  targets,
  compact = false,
  onSelectClass,
  expandedClass,
  controlsId,
}: {
  targets: ReviewTarget[];
  compact?: boolean;
  onSelectClass?: (key: string) => void;
  expandedClass?: string | null;
  controlsId?: string;
}) {
  const groups = groupIssues(targets);
  if (!groups.length) return compact ? (
    <div className="issue-distribution thread-issue-bar" role="img" aria-label="Good to go">
      <span style={{ flex: 1, background: "var(--green)" }} />
    </div>
  ) : null;
  return (
    <div
      className={`issue-distribution ${compact ? "thread-issue-bar" : ""}`}
      role={onSelectClass ? "group" : "img"}
      aria-label={
        groups
          .map((group) => `${group.count} ${group.label.toLowerCase()}`)
          .join(", ") || "No issues"
      }
    >
      {groups.map((group) => onSelectClass ? (
        <button
          key={group.key}
          data-issue-class={group.key}
          data-count={group.count}
          style={{ flex: group.count, background: issueColor(group.hue) }}
          aria-label={`${group.count} ${group.label.toLowerCase()}`}
          aria-expanded={expandedClass === group.key}
          aria-controls={controlsId}
          onClick={() => onSelectClass(group.key)}
        />
      ) : (
        <span
          key={group.key}
          data-issue-class={group.key}
          data-count={group.count}
          style={{ flex: group.count, background: issueColor(group.hue) }}
        />
      ))}
    </div>
  );
}
