import { useMemo, useState } from "react";
import fixture from "./data/state.json";
import type { Vendor } from "./lib/types";
import { buildThreadModel } from "./lib/evidence";
import { formatDate, latestResponse } from "./lib/review";
import { EmailPane } from "./components/EmailPane";
import { ExtractedPane } from "./components/ExtractedPane";
import { FollowUpPane } from "./components/FollowUpPane";
import { followUpItems, type FollowUpState } from "./lib/followUp";
import { IssueBar } from "./components/IssueBar";
import { Icon } from "./components/Icon";
import { ResizablePane } from "./components/ResizablePane";
import { buildFieldLinks } from "./lib/fieldLinks";

const vendors: Vendor[] = fixture.vendors;
const emptyFollowUp = (): FollowUpState => ({
  added: [],
  included: [],
  body: null,
  draftedIds: [],
});
export interface Selection {
  productId: string;
  sourceId?: string;
  targetId?: string;
  linkId?: string;
  origin: "source" | "field" | "guide";
  sequence: number;
}
export default function App() {
  const [vendorId, setVendorId] = useState(vendors[0].id);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [middleView, setMiddleView] = useState<"review" | "follow-up">("review");
  const models = useMemo(
    () =>
      new Map(vendors.map((vendor) => [vendor.id, buildThreadModel(vendor)])),
    [],
  );
  const followUps = useMemo(() => new Map(vendors.map((item) => [item.id, followUpItems(item, models.get(item.id)!)])), [models]);
  const [drafts, setDrafts] = useState<Record<string, FollowUpState>>({});
  const vendor = vendors.find((item) => item.id === vendorId)!;
  const model = models.get(vendor.id)!;
  const fieldLinks = useMemo(() => buildFieldLinks(vendor, model), [vendor, model]);
  const filtered = vendors.filter((item) =>
    `${item.name} ${item.emails.map((email) => `${email.fromName} ${email.subject} ${email.body}`).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function select(
    productId: string,
    sourceId: string | undefined,
    origin: Selection["origin"],
    targetId?: string,
    linkId?: string,
  ) {
    const alreadyFlagged = !!targetId && (drafts[vendor.id]?.added ?? []).includes(targetId);
    setReviewOpen(!!targetId && (
      middleView === "review" || origin === "guide" ||
      (origin === "source" && !alreadyFlagged)
    ));
    setSelection((previous) => ({
      productId,
      sourceId,
      targetId,
      linkId,
      origin,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
  }
  const reviewIndex = model.targets.findIndex(
    (target) => target.id === selection?.targetId,
  );
  const reviewTarget = model.targets[reviewIndex];
  function moveReview(offset: number) {
    const target = model.targets[reviewIndex + offset];
    if (target) select(target.productId, target.source?.id, "guide", target.id);
  }
  const followUpState = drafts[vendor.id] ?? emptyFollowUp();
  const currentFollowUp = followUps
    .get(vendor.id)!
    .find((item) => item.target.id === reviewTarget?.id);
  function toggleFollowUp(targetId: string) {
    const item = followUps
      .get(vendor.id)!
      .find((candidate) => candidate.target.id === targetId);
    if (!item || item.destination !== "vendor") return;
    const previous = drafts[vendor.id] ?? emptyFollowUp();
    const id = item.target.id;
    const added = previous.added.includes(id);
    setDrafts((all) => ({
      ...all,
      [vendor.id]: {
        ...previous,
        added: added
          ? previous.added.filter((value) => value !== id)
          : [...previous.added, id],
        included: added
          ? previous.included.filter((value) => value !== id)
          : previous.included.includes(id)
            ? previous.included
            : [...previous.included, id],
      },
    }));
  }
  return (
    <main
      className={`mail-workspace follow-up-workspace ${reviewOpen && reviewTarget ? "review-active" : ""}`}
    >
      <aside className="thread-list" aria-label="Email threads">
        <header className="column-header">
          <h1>Threads</h1>
          <span>{vendors.length}</span>
        </header>
        <label className="thread-search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search threads"
            placeholder="Search threads"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
        <div className="thread-items">
          {filtered.map((item) => {
            const latest = latestResponse(item);
            const flags = models.get(item.id)!.targets.length;
            return (
              <button
                key={item.id}
                className={`thread-item ${item.id === vendorId ? "selected" : ""}`}
                aria-pressed={item.id === vendorId}
                onClick={() => {
                  setVendorId(item.id);
                  setSelection(null);
                  setReviewOpen(false);
                  setMiddleView("review");
                }}
              >
                <div className="thread-sender">
                  <strong>{item.name}</strong>
                  <time>{formatDate(latest.date)}</time>
                </div>
                <div className="thread-subject">{item.emails[0].subject}</div>
                <p>{latest.body.trim().replace(/\s+/g, " ")}</p>
                <div className="thread-meta">
                  <span>{item.emails.length} messages</span>
                  {flags > 0 ? <span className="flag-label">
                    <Icon name="caution" size={12} />
                    {flags} issues to resolve
                  </span> : <span className="all-clear" role="img" aria-label="No issues to resolve"><Icon name="checked" size={16} /></span>}
                </div>
                <IssueBar targets={models.get(item.id)!.targets} compact />
              </button>
            );
          })}
          {!filtered.length && <p className="empty">No matching threads.</p>}
        </div>
      </aside>
      <ResizablePane key={`${vendor.id}-${middleView}`} autoFit={middleView === "follow-up"}>
        <div className="workspace-tabs" role="tablist" aria-label="Quotation workflow">
          <button
            role="tab"
            aria-selected={middleView === "review"}
            onClick={() => setMiddleView("review")}
          >
            Quote review
          </button>
          <button
            role="tab"
            aria-selected={middleView === "follow-up"}
            onClick={() => {
              setMiddleView("follow-up");
              setReviewOpen(false);
            }}
          >
            Follow up with vendor
            {!!followUpState.added.length && <span>{followUpState.added.length}</span>}
          </button>
        </div>
        {middleView === "review" ? (
          <ExtractedPane
            onNavigate={(target) => select(target.productId, target.source?.id, "guide", target.id)}
            fieldLinks={fieldLinks}
            key={`fields-${vendor.id}`}
            vendor={vendor}
            model={model}
            selection={selection}
            followUpIds={new Set(followUps.get(vendor.id)!
              .filter((item) => item.destination === "vendor")
              .map((item) => item.target.id))}
            addedFollowUpIds={new Set(followUpState.added)}
            onToggleFollowUp={toggleFollowUp}
            onSelect={(productId, sourceId, targetId, linkId) =>
              select(productId, sourceId, "field", targetId, linkId)
            }
          />
        ) : (
          <FollowUpPane
            key={`follow-up-${vendor.id}`}
            vendor={vendor}
            items={followUps.get(vendor.id)!}
            state={followUpState}
            onChange={(state) =>
              setDrafts((previous) => ({ ...previous, [vendor.id]: state }))
            }
            selection={selection}
            onSelect={(target) =>
              select(target.productId, target.source?.id, "field", target.id)
            }
          />
        )}
      </ResizablePane>
      <EmailPane
        alignSelection={middleView === "review"}
        fieldLinks={fieldLinks}
        key={`email-${vendor.id}`}
        followUpIds={new Set(followUps.get(vendor.id)!
          .filter((item) => item.destination === "vendor")
          .map((item) => item.target.id))}
        addedFollowUpIds={new Set(followUpState.added)}
        onToggleFollowUp={toggleFollowUp}
        guide={
          reviewOpen && reviewTarget
            ? {
                target: reviewTarget,
                index: reviewIndex,
                total: model.targets.length,
                partNumber: vendor.products.find(
                  (product) => product.id === reviewTarget.productId,
                )!.partNumber,
                onPrevious: () => moveReview(-1),
                onNext: () => moveReview(1),
                onClose: () => setReviewOpen(false),
                followUp:
                  currentFollowUp?.destination === "vendor"
                    ? {
                        added: followUpState.added.includes(reviewTarget.id),
                        onToggle: () => toggleFollowUp(reviewTarget.id),
                        onOpen: () => {
                          if (!followUpState.added.includes(reviewTarget.id)) {
                            toggleFollowUp(reviewTarget.id);
                          }
                          setReviewOpen(false);
                          setMiddleView("follow-up");
                        },
                      }
                    : undefined,
              }
            : null
        }
        vendor={vendor}
        model={model}
        selection={selection}
        onSelect={(productId, sourceId, targetId, linkId) => {
          select(productId, sourceId, "source", targetId, linkId);
        }}
      />
    </main>
  );
}
