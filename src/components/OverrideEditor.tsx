import { useCallback, useEffect, useRef, useState } from "react";
import { booleanFields, validateOverride, type EditTarget, type OverrideValue } from "../lib/audit";
import { Icon } from "./Icon";

export function EditPencil({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="override-pencil" aria-label={`Edit ${label}`} title="Manual override"
    onClick={event => { event.stopPropagation(); onClick(); }}><Icon name="pencil" size={16} /></button>;
}
export function OverrideEditor({ target, value, onSave, onCancel }: {
  target: EditTarget; value: OverrideValue | null;
  onSave: (value: OverrideValue) => void; onCancel: () => void;
}) {
  const [input, setInput] = useState(value === null ? "" : String(value));
  const [error, setError] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const finished = useRef(false);
  const submit = useCallback(() => {
    if (finished.current) return;
    try {
      const parsed = validateOverride(target, input);
      finished.current = true;
      onSave(parsed);
    } catch (error) { setError((error as Error).message); }
  }, [input, target, onSave, onCancel]);
  useEffect(() => {
    const form = ref.current;
    const pane = form?.closest(".fields-scroll");
    if (form && pane) {
      const bounds = form.getBoundingClientRect(), clip = pane.getBoundingClientRect();
      if (bounds.top < clip.top || bounds.bottom > clip.bottom) form.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    ref.current?.querySelector<HTMLElement>("input, select")?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const clickAway = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) submit();
    };
    document.addEventListener("pointerdown", clickAway);
    return () => document.removeEventListener("pointerdown", clickAway);
  }, [submit]);
  const label = `Override ${target.label}`;
  return <form className="override-editor" ref={ref} onClick={e => e.stopPropagation()}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) submit(); }}
    onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); finished.current = true; onCancel(); }
      if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
    }}
    onSubmit={e => { e.preventDefault(); submit(); }}>
      {booleanFields.includes(target.field) ? <select aria-label={label} value={input} onChange={e => setInput(e.target.value)}>
        <option value="">Empty</option><option value="true">Yes</option><option value="false">No</option>
      </select> : <input aria-label={label} value={input} onChange={e => setInput(e.target.value)}
        inputMode={["unitCost", "price", "leadTime"].includes(target.field) ? "decimal" : "text"} />}
    {error && <span className="override-error" role="alert">{error}</span>}
  </form>;
}
