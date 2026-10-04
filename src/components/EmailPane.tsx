import { Fragment, useEffect, useRef } from "react";
import type { Vendor } from "../lib/types";
import type { SourceSection, ThreadModel } from "../lib/evidence";
import type { Selection } from "../App";
import {
  formatDate,
  latestResponse,
  matchRequest,
  requestedParts,
} from "../lib/review";
import { EvidenceMark } from "./EvidenceMark";
import { ReviewNavigator, type ReviewGuide } from "./ReviewNavigator";
import { centerInPane } from "../lib/scroll";
import { Icon } from "./Icon";

interface Props {
  guide: ReviewGuide | null;
  vendor: Vendor;
  model: ThreadModel;
  selection: Selection | null;
  onSelect: (productId: string, sourceId: string, targetId?: string) => void;
}
export function EmailPane({
  vendor,
  model,
  selection,
  onSelect,
  guide,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const requests = requestedParts(vendor);
  const latest = latestResponse(vendor);
  useEffect(() => {
    if (
      !selection?.sourceId ||
      (!selection.targetId && selection.origin === "source")
    )
      return;
    const scroll = scrollRef.current;
    const target = document.getElementById(
      selection.targetId
        ? `source-target-${selection.targetId}`
        : `source-${selection.sourceId}`,
    );
    if (scroll && target) centerInPane(scroll, target);
  }, [selection, !!guide]);
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
                  !selection?.targetId && selection?.sourceId === line.id;
                const segments = [];
                let cursor = 0;
                for (const target of exact) {
                  const [start, end] = target.range!;
                  segments.push(
                    <Fragment key={target.id}>
                      <span>{line.text.slice(cursor, start)}</span>
                      <EvidenceMark
                        target={target}
                        side="source"
                        active={selection?.targetId === target.id}
                        onSelect={(target) =>
                          onSelect(target.productId, line.id, target.id)
                        }
                      >
                        {line.text.slice(start, end)}
                      </EvidenceMark>
                    </Fragment>,
                  );
                  cursor = end;
                }
                if (exact.length)
                  segments.push(
                    <span key="tail">{line.text.slice(cursor)}</span>,
                  );
                return (
                  <div
                    key={line.id}
                    id={`source-${line.id}`}
                    className={`email-line ${active ? "active-line" : ""}`}
                  >
                    {exact.length ? (
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
                        <EvidenceMark
                          target={target}
                          side="source"
                          active={selection?.targetId === target.id}
                          onSelect={(target) =>
                            onSelect(target.productId, line.id, target.id)
                          }
                        >
                          {target.label}
                        </EvidenceMark>
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
