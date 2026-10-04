import { Fragment, useEffect, useRef } from "react";
import type { Vendor } from "../lib/types";
import type { SourceSection, ThreadModel, ReviewTarget } from "../lib/evidence";
import type { Selection } from "../App";
import {
  formatDate,
  latestResponse,
  matchRequest,
  requestedParts,
} from "../lib/review";
import { EvidenceMark } from "./EvidenceMark";
import { ReviewNavigator, type ReviewGuide } from "./ReviewNavigator";
import { alignPair, centerInPane, centerPair } from "../lib/scroll";
import { Icon } from "./Icon";
import { FollowUpFlag } from "./FollowUpFlag";
import type { FieldLink } from "../lib/fieldLinks";

interface Props {
  alignSelection: boolean;
  fieldLinks: FieldLink[];
  guide: ReviewGuide | null;
  vendor: Vendor;
  model: ThreadModel;
  selection: Selection | null;
  followUpIds: Set<string>;
  addedFollowUpIds: Set<string>;
  onToggleFollowUp: (id: string) => void;
  onSelect: (productId: string, sourceId: string, targetId?: string, linkId?: string) => void;
}
export function EmailPane({
  alignSelection,
  fieldLinks,
  vendor,
  model,
  selection,
  onSelect,
  guide,
  followUpIds,
  addedFollowUpIds,
  onToggleFollowUp,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const requests = requestedParts(vendor);
  const latest = latestResponse(vendor);
  useEffect(() => {
    if (!selection?.sourceId) return;
    const scroll = scrollRef.current;
    const target = document.getElementById(
      selection.linkId ? `source-link-${selection.linkId}` : selection.targetId
        ? `source-target-${selection.targetId}`
        : `source-${selection.sourceId}`,
    );
    const counterpart = selection.linkId
      ? document.getElementById(`field-link-${selection.linkId}`)
      : selection.targetId
        ? document.getElementById(`field-target-${selection.targetId}`)
        : document.querySelector<HTMLElement>(".extracted .source-selected-field") ??
          document.getElementById(`part-header-${selection.productId}`);
    if (selection.origin === "guide") {
      if (alignSelection && target && counterpart) centerPair(counterpart, target);
      else if (scroll && target) centerInPane(scroll, target);
      return;
    }
    // Follow-up selection never levels the list against the source email.
    if (!alignSelection) return;
    if (target && counterpart) {
      if (selection.origin === "source") alignPair(target, counterpart);
      else alignPair(counterpart, target);
    }
    else if (scroll && target && selection.origin !== "source") centerInPane(scroll, target);
  }, [selection, alignSelection]);
  function mark(target: ReviewTarget, sourceId: string, text: string) {
    const label = <EvidenceMark target={target} side="source"
      active={selection?.targetId === target.id}
      onSelect={() => onSelect(target.productId, sourceId, target.id)}>{text}</EvidenceMark>;
    if (!followUpIds.has(target.id)) return label;
    return <span className="field-evidence-actions source-evidence-actions">
      {label}
      <FollowUpFlag label={target.label} added={addedFollowUpIds.has(target.id)}
        onToggle={() => onToggleFollowUp(target.id)} />
    </span>;
  }
  function renderSource(section: SourceSection) {
    return (
      <div className="message-body" key={section.id}>
        {section.blocks.map((block, blockIndex) => {
          const product = vendor.products.find(
            (product) =>
              product.partNumber === block.partNumber ||
              matchRequest(product, requests)?.partNumber === block.partNumber,
          );
          return (
            <div
              className={`email-block ${block.partNumber ? "part-block" : ""}`}
              key={blockIndex}
            >
              {block.lines.map((line) => {
                const targets = model.targets.filter(
                  (target) => target.source?.id === line.id,
                );
                const exact = targets
                  .filter((target) => target.range)
                  .sort((a, b) => a.range![0] - b.range![0]);
                const inferred = targets.filter(
                  (target) => target.location === "inferred",
                );
                const active =
                  !selection?.linkId && !selection?.targetId && selection?.sourceId === line.id;
                const links = fieldLinks.filter(link => link.sourceId === line.id &&
                  !exact.some(target => target.range![0] < link.range[1] && target.range![1] > link.range[0]));
                const regions = [
                  ...exact.map(target => ({ range: target.range!, key: target.id,
                    content: mark(target, line.id, line.text.slice(...target.range!)) })),
                  ...links.map(link => ({ range: link.range, key: link.id,
                    content: <button id={`source-link-${link.id}`}
                      className={`source-field-region ${selection?.linkId === link.id ? "selected-linked-value" : ""}`}
                      onClick={() => onSelect(link.productId, line.id, undefined, link.id)}>
                      {line.text.slice(...link.range)}
                    </button> })),
                ].sort((a, b) => a.range[0] - b.range[0]);
                const segments = [];
                let cursor = 0;
                for (const region of regions) {
                  const [start, end] = region.range;
                  segments.push(
                    <Fragment key={region.key}>
                      <span>{line.text.slice(cursor, start)}</span>
                      {region.content}
                    </Fragment>,
                  );
                  cursor = end;
                }
                if (regions.length)
                  segments.push(
                    <span key="tail">{line.text.slice(cursor)}</span>,
                  );
                return (
                  <div
                    key={line.id}
                    id={`source-${line.id}`}
                    className={`email-line ${active ? "active-line" : ""}`}
                  >
                    {regions.length ? (
                      <div className="marked-source-line">{segments}</div>
                    ) : product && line.text.trim() ? (
                      <button
                        className="plain-source-line"
                        onClick={() => onSelect(product.id, line.id)}
                        title={`Inspect ${product.partNumber}`}
                      >
                        <span>{line.text}</span>
                      </button>
                    ) : (
                      <span>{line.text || "\u00a0"}</span>
                    )}
                    {inferred.map((target) => (
                      <div className="inferred-source-note" key={target.id}>
                        <span className="annotation-label">
                          Review note · expected here
                        </span>
                        {mark(target, line.id, target.label)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <section className="conversation" aria-label="Email conversation">
      <header className="column-header conversation-title">
        <h2>{vendor.emails[0].subject}</h2>
        <span>{vendor.emails.length} messages</span>
      </header>
      <div className="conversation-scroll" ref={scrollRef}>
        {[...vendor.emails]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((email) => (
            <article
              className="message"
              key={email.id}
              aria-label={`${email.from === vendor.contactEmail ? "Received" : "Sent"}: ${email.subject}`}
            >
              <header className="message-header">
                <div className="message-participants">
                  <strong title={email.from}>{email.fromName}</strong>
                  <span className="sender-email">&lt;{email.from}&gt;</span>
                  <span className="recipient-inline">to {email.to}</span>
                </div>
                <div className="message-date">
                  <time>
                    {formatDate(email.date)},{" "}
                    {new Date(email.date).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  <span>
                    {email.from === vendor.contactEmail ? "Received" : "Sent"}
                    {email.id === latest.id ? " · Latest reply" : ""}
                  </span>
                </div>
              </header>
              {email.subject !== vendor.emails[0].subject && (
                <div className="reply-subject">{email.subject}</div>
              )}
              {model.sources
                .filter((source) => source.emailId === email.id)
                .map((source) =>
                  source.attachmentName ? (
                    <section className="attachment" key={source.id}>
                      <header>
                        <Icon name="file" size={14} />
                        <strong>{source.attachmentName}</strong>
                        <span>Page {source.page} · attachment text</span>
                      </header>
                      {renderSource(source)}
                    </section>
                  ) : (
                    renderSource(source)
                  ),
                )}
            </article>
          ))}
      </div>
      {guide && <ReviewNavigator guide={guide} />}
    </section>
  );
}
