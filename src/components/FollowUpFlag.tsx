import { Icon } from "./Icon";

export function FollowUpFlag({ label, added, onToggle }: {
  label: string;
  added: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`vendor-follow-up-flag ${added ? "added" : ""}`}
      aria-label={`${added ? "Remove from" : "Add to"} vendor follow-up: ${label}`}
      aria-pressed={added}
      title={added ? "Remove from vendor follow-up" : "Add to vendor follow-up"}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
    >
      <Icon name="flag" size={18} />
    </button>
  );
}
