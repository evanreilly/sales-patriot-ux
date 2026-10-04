import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { ReviewTarget } from "../lib/evidence";
import { issueStyle, issueColor, issueTextColor } from "../lib/issueClasses";
import { centerInPane } from "../lib/scroll";
import { Icon } from "./Icon";

export interface ReviewGuide {
  target: ReviewTarget;
  index: number;
  total: number;
  partNumber: string;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}
export function ReviewNavigator({ guide }: { guide: ReviewGuide }) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") guide.onClose();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [guide.onClose]);
  // Anchor to the actual source marker rather than a corner of the viewport.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const container = card?.parentElement;
    const pane = container?.querySelector<HTMLElement>(".conversation-scroll");
    const target = document.getElementById(`source-target-${guide.target.id}`);
    if (!card || !container || !pane || !target) return;
    const position = () => {
      const bounds = container.getBoundingClientRect(),
        clip = pane.getBoundingClientRect(),
        anchor = target.getBoundingClientRect();
      const width = Math.min(440, container.clientWidth - 32);
      const anchorX = anchor.left + anchor.width / 2 - bounds.left;
      const left = Math.max(
        16,
        Math.min(anchorX - width / 2, container.clientWidth - width - 16),
      );
      const top = anchor.bottom - bounds.top + 16;
      Object.assign(card.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        maxHeight: `${Math.max(80, container.clientHeight - top - 16)}px`,
        visibility:
          anchor.top >= clip.top && anchor.bottom <= clip.bottom
            ? "visible"
            : "hidden",
      });
      card.style.setProperty("--anchor-x", `${anchorX - left}px`);
    };
    const resize = () => {
      centerInPane(pane, target);
      position();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(pane);
    pane.addEventListener("scroll", position);
    const frame = requestAnimationFrame(position);
    position();
    return () => {
      observer.disconnect();
      pane.removeEventListener("scroll", position);
      cancelAnimationFrame(frame);
    };
  }, [guide.target.id]);
  const category = issueStyle(guide.target);
  return (
    <section
      className="review-navigator"
      ref={cardRef}
      role="dialog"
      aria-label="Issue review"
      aria-modal="false"
      style={{ "--guide-color": issueColor(category.hue) } as CSSProperties}
    >
      <div className="review-navigator-body">
      <div className="review-navigator-top">
        <span style={{ color: issueTextColor(category.hue) }}>
          {category.label}
        </span>
        <span>
          {guide.index + 1} of {guide.total}
        </span>
        <button aria-label="Close issue review" onClick={guide.onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="review-navigator-content" aria-live="polite">
        <h3>{guide.target.label}</h3>
        <span className="review-part">
          {guide.partNumber} ·{" "}
          {guide.target.location === "inferred"
            ? "Suggested location"
            : "Vendor source"}
        </span>
        <p>{guide.target.explanation}</p>
      </div>
      <div className="review-navigator-actions">
        <button
          className="review-previous"
          disabled={guide.index === 0}
          onClick={guide.onPrevious}
        >
          Previous
        </button>
        <button
          className="review-next"
          ref={nextRef}
          onClick={
            guide.index === guide.total - 1 ? guide.onClose : guide.onNext
          }
        >
          {guide.index === guide.total - 1 ? "Finish review" : "Next field"}
          <Icon name="arrow" size={15} />
        </button>
      </div>
      </div>
    </section>
  );
}
