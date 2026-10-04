import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

export function ResizablePane({ children, autoFit = false }: { children: ReactNode; autoFit?: boolean }) {
  const pane = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [maximum, setMaximum] = useState(900);
  const [dragging, setDragging] = useState(false);
  const [contentWidth, setContentWidth] = useState(560);
  useLayoutEffect(() => {
    if (!autoFit) return;
    const context = document.createElement("canvas").getContext("2d")!;
    const measure = (element: HTMLElement) => {
      context.font = getComputedStyle(element).font;
      return context.measureText(element.textContent ?? "").width;
    };
    let longest = 560;
    for (const row of pane.current!.querySelectorAll<HTMLElement>(".follow-up-issue")) {
      const title = row.querySelector<HTMLElement>(".follow-up-title")!;
      const question = row.querySelector<HTMLElement>(".follow-up-copy p")!;
      const titleWidth = Math.min(measure(title), parseFloat(getComputedStyle(title).maxWidth) || Infinity);
      const questionWidth = Math.min(measure(question), parseFloat(getComputedStyle(question).maxWidth) || Infinity);
      // Row padding, checkbox, gaps, divider, number gutter and scrollbar allowance.
      longest = Math.max(longest, Math.ceil(titleWidth + questionWidth + 132));
    }
    setContentWidth(longest);
  }, [autoFit, children]);
  useLayoutEffect(() => {
    const workspace = pane.current!.parentElement!;
    const observer = new ResizeObserver(() => {
      const threads = workspace.querySelector(".thread-list")!.getBoundingClientRect().width;
      setMaximum(Math.max(400, workspace.clientWidth - threads - 350));
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);
  const clamp = (value: number) => Math.round(Math.max(400, Math.min(maximum, value)));
  const actual = width === null ? (autoFit ? clamp(contentWidth) : null) : clamp(width);
  useLayoutEffect(() => {
    const workspace = pane.current!.parentElement!;
    if (actual === null) workspace.style.removeProperty("--review-width");
    else workspace.style.setProperty("--review-width", `${actual}px`);
    return () => { workspace.style.removeProperty("--review-width"); };
  }, [actual]);
  return (
    <section ref={pane} className={`middle-pane ${dragging ? "resizing" : ""} ${autoFit && width === null ? "auto-follow-up" : ""}`}>
      {children}
      <div className="pane-resizer" role="separator" tabIndex={0}
        aria-label="Resize quotation column" aria-orientation="vertical"
        aria-valuemin={400} aria-valuemax={maximum} aria-valuenow={actual ?? Math.min(560, maximum)}
        title="Drag to resize · Double-click to reset"
        style={{ touchAction: "none" } as CSSProperties}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag.current = { x: event.clientX, width: pane.current!.getBoundingClientRect().width };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (drag.current) setWidth(clamp(drag.current.width + event.clientX - drag.current.x));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onDoubleClick={() => setWidth(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Home") { event.preventDefault(); setWidth(null); }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setWidth(clamp(pane.current!.getBoundingClientRect().width + (event.key === "ArrowRight" ? 20 : -20)));
          }
        }} />
    </section>
  );
}
