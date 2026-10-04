import { useEffect, useState, type CSSProperties } from "react";
import type { Selection } from "../App";
import type { Vendor } from "../lib/types";
import type { ReviewTarget } from "../lib/evidence";
import { draftFollowUp, type FollowUpItem, type FollowUpState } from "../lib/followUp";
import { issueColor, issueTextColor } from "../lib/issueClasses";

export function FollowUpPane({ vendor, items, state, onChange, selection, onSelect }: {
  vendor: Vendor;
  items: FollowUpItem[];
  state: FollowUpState;
  onChange: (state: FollowUpState) => void;
  selection: Selection | null;
  onSelect: (target: ReviewTarget) => void;
}) {
  const [sendStatus, setSendStatus] = useState("");
  const vendorItems = items.filter(
    (item) => item.destination === "vendor" && state.added.includes(item.target.id),
  );
  const generated = draftFollowUp(vendor, items, state.included);
  const body = state.body ?? generated;
  const stale = state.body !== null && JSON.stringify(state.included) !== JSON.stringify(state.draftedIds);
  const subject = `Re: ${vendor.emails[0].subject.replace(/^Re:\s*/i, "")}`;
  useEffect(() => { setSendStatus(""); }, [body]);
  function toggle(id: string) {
    onChange({
      ...state,
      included: state.included.includes(id)
        ? state.included.filter((value) => value !== id)
        : [...state.included, id],
    });
  }
  function sendEmail() {
    const url = `mailto:${encodeURIComponent(vendor.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSendStatus("Opening your email app…");
    window.location.assign(url);
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
              style={{ "--follow-up-color": issueColor(item.target.hue) } as CSSProperties}
              className={`follow-up-issue ${selection?.targetId === item.target.id ? "selected-follow-up" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`View source for ${item.target.label}`}
              onClick={() => onSelect(item.target)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(item.target);
                }
              }}>
              {selectable && <input type="checkbox" checked={state.included.includes(item.target.id)}
                aria-label={`Include ${item.target.label} for ${product.partNumber} in draft`}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggle(item.target.id)} />}
              <div className="follow-up-copy">
                <strong className="follow-up-title">{item.target.label}</strong>
                <span className="follow-up-divider" aria-hidden="true" />
                <p title={selectable ? item.question : item.reason}>{selectable ? item.question : item.reason}</p>
              </div>
              <span className="follow-up-number" style={{ color: issueTextColor(item.target.hue) }}>{String(item.target.number).padStart(2, "0")}</span>
            </div>
          ))}
        </section>
      );
    });
  }
  return (
    <section className="follow-up-pane" aria-label="Vendor follow-up">
      <header className="column-header"><h2>Follow-up email</h2><span>{state.included.length} of {state.added.length} included</span></header>
      <div className="follow-up-scroll">
        <div className="follow-up-section-heading"><strong>Questions for the vendor <span>{vendorItems.length}</span></strong><p>Add questions from the issue review. Select one here to see its source in the email.</p></div>
        {renderItems(vendorItems, true)}
        {!vendorItems.length && <div className="follow-up-empty"><strong>No questions added yet.</strong><p>Return to Quote review, open an issue, and choose “Follow up with vendor.”</p></div>}
      </div>
      <section className="follow-up-composer" aria-label="Follow-up email draft">
        <header><strong>Email preview</strong><span>{state.body === null ? "From added questions" : "Edited draft"}</span></header>
        <div className="draft-address"><span>To</span><strong>{vendor.contactName}</strong><span>{vendor.contactEmail}</span></div>
        <div className="draft-subject"><span>Subject</span><strong>{subject}</strong></div>
        {stale && <div className="draft-stale"><span>Your selection changed. Your edits are preserved.</span><button onClick={() => onChange({ ...state, body: null, draftedIds: state.included })}>Replace draft from selection</button></div>}
        <textarea aria-label="Email draft body" value={body} placeholder="Select vendor questions above to start a draft."
          onChange={(event) => onChange({ ...state, body: event.target.value, draftedIds: state.body === null ? state.included : state.draftedIds })} />
        <footer><span role="status">{sendStatus || "Review before sending"}</span><button className="send-email" disabled={!body.trim()} onClick={sendEmail}>Send email</button></footer>
      </section>
    </section>
  );
}
