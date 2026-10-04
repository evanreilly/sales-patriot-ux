import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ISSUE_CLASSES, issueColor } from "../lib/issueClasses";
import type { ReviewTarget } from "../lib/evidence";

interface Props {
  target: ReviewTarget;
  side: "field" | "source";
  active?: boolean;
  children: ReactNode;
  onSelect: (target: ReviewTarget) => void;
}
export function EvidenceMark({
  target,
  side,
  active,
  children,
  onSelect,
}: Props) {
  const tooltipId = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [position]);
  const primaryHue = ISSUE_CLASSES[target.category].hue;
  const style = {
    "--mark-bg": `hsl(${primaryHue} 88% 84%)`,
    "--mark-ink": `hsl(${primaryHue} 80% 19%)`,
    "--mark-border": issueColor(primaryHue),
  } as CSSProperties;
  function show(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: Math.max(8, Math.min(rect.bottom + 7, window.innerHeight - 200)),
    });
  }
  return (
    <>
      <button
        id={`${side}-target-${target.id}`}
        data-target-id={target.id}
        data-side={side}
        className={`evidence-mark ${active ? "active-mark" : ""}`}
        style={style}
        aria-label={`${target.label}. ${target.explanation}`}
        aria-describedby={position ? tooltipId : undefined}
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={() => setPosition(null)}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={() => setPosition(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPosition(null);
            event.stopPropagation();
          }
        }}
        onClick={() => {
          setPosition(null);
          onSelect(target);
        }}
      >
        <span>{children}</span>
      </button>
      {position &&
        createPortal(
          <div
            role="tooltip"
            id={tooltipId}
            className="evidence-tooltip"
            style={{ ...style, ...position }}
          >
            <strong>
              {target.label}
            </strong>
            <p>{target.explanation}</p>
            <small>
              {target.location === "inferred"
                ? "Suggested location · review annotation, not email text"
                : "Linked to the vendor’s actual text"}{" "}
              · Click to locate {side === "field" ? "source" : "field"}
            </small>
          </div>,
          document.body,
        )}
    </>
  );
}
