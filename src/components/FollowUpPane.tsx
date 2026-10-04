import { useEffect, useRef, useState } from "react";
import type { Selection } from "../App";
import type { Vendor } from "../lib/types";
import type { ReviewTarget } from "../lib/evidence";
import { draftFollowUp, type FollowUpItem, type FollowUpState } from "../lib/followUp";
import { issueColor, issueTextColor } from "../lib/issueClasses";
import { centerInPane } from "../lib/scroll";

export function FollowUpPane({ vendor, items, state, onChange, selection, onSelect }: {
  vendor: Vendor;
  items: FollowUpItem[];
  state: FollowUpState;
  onChange: (state: FollowUpState) => void;
  selection: Selection | null;
  onSelect: (target: ReviewTarget) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const vendorItems = items.filter((item) => item.destination === "vendor");
  const internal = items.filter((item) => item.destination === "extraction");
  const generated = draftFollowUp(vendor, items, state.included);
  const body = state.body ?? generated;
  const stale = state.body !== null && JSON.stringify(state.included) !== JSON.stringify(state.draftedIds);
  const subject = `Re: ${vendor.emails[0].subject.replace(/^Re:\s*/i, "")}`;
  useEffect(() => {
    if (!selection?.targetId) return;
    const target = document.getElementById(`follow-up-${selection.targetId}`);
    if (target && scrollRef.current) centerInPane(scrollRef.current, target);
  }, [selection]);
  useEffect(() => { setCopyStatus(""); }, [body]);
  function toggle(id: string) {
    onChange({ ...state, included: state.included.includes(id) ? state.included.filter((value) => value !== id) : [...state.included, id] });
  }
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`To: ${vendor.contactEmail}\nSubject: ${subject}\n\n${body}`);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Select the draft text to copy it manually.");
    }
  }
  function renderItems(list: FollowUpItem[], selectable: boolean) {
    return vendor.products.map((product) => {
      const partItems = list.filter((item) => item.product.id === product.id);
      if (!partItems.length) return null;
      return (
        <section className="follow-up-part" key={product.id}>
          <header><strong>{product.description}</strong><span>{product.partNumber}</span></header>
          {partItems.map((item) => (
            <div id={`follow-up-${item.target.id}`} key={item.target.id}
              className={`follow-up-issue ${selection?.targetId === item.target.id ? "selected-follow-up" : ""}`}>
              {selectable && <input type="checkbox" checked={state.included.includes(item.target.id)}
                aria-label={`Include ${item.target.label} for ${product.partNumber} in draft`}
                onChange={() => toggle(item.target.id)} />}
              <div>
                <button className="follow-up-evidence" onClick={() => onSelect(item.target)}>
                  <span className="follow-up-number" style={{ color: issueTextColor(item.target.hue), borderColor: issueColor(item.target.hue) }}>{String(item.target.number).padStart(2, "0")}</span>
                  <strong>{item.target.label}</strong><span className="source-link">View source ↗</span>
                </button>
                <p>{selectable ? item.question : item.reason}</p>
                {selectable && !item.recommended && <small>{item.reason}</small>}
              </div>
            </div>
          ))}
        </section>
      );
    });
  }
  return (
    <section className="follow-up-pane" aria-label="Vendor follow-up">
      <header className="column-header"><h2>Vendor follow-up</h2><span>{state.included.length} selected</span></header>
      <div className="follow-up-scroll" ref={scrollRef}>
        <div className="follow-up-section-heading"><strong>Ask the vendor <span>{vendorItems.length}</span></strong><p>Select the questions to include in your email.</p></div>
        {renderItems(vendorItems, true)}
        {!vendorItems.length && <p className="follow-up-empty">No vendor questions identified.</p>}
        {!!internal.length && <>
          <div className="follow-up-section-heading internal-heading"><strong>Check extraction <span>{internal.length}</span></strong><p>Review these against the reply. They are not included in the vendor email.</p></div>
          {renderItems(internal, false)}
        </>}
      </div>
      <section className="follow-up-composer" aria-label="Follow-up email draft">
        <header><strong>Email draft</strong><span>{state.body === null ? "From selected questions" : "Edited draft"}</span></header>
        <div className="draft-address"><span>To</span><strong>{vendor.contactName}</strong><span>{vendor.contactEmail}</span></div>
        <div className="draft-subject"><span>Subject</span><strong>{subject}</strong></div>
        {stale && <div className="draft-stale"><span>Your selection changed. Your edits are preserved.</span><button onClick={() => onChange({ ...state, body: null, draftedIds: state.included })}>Replace draft from selection</button></div>}
        <textarea aria-label="Email draft body" value={body} placeholder="Select vendor questions above to start a draft."
          onChange={(event) => onChange({ ...state, body: event.target.value, draftedIds: state.body === null ? state.included : state.draftedIds })} />
        <footer><span role="status">{copyStatus || "Draft only · not sent"}</span><button className="copy-draft" disabled={!body.trim()} onClick={copyDraft}>Copy email</button></footer>
      </section>
    </section>
  );
}
