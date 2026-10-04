import type { ReactNode } from "react";
import type { Product, Vendor } from "../lib/types";
import type { ThreadModel, SourceLine, ReviewTarget } from "../lib/evidence";
import type { Selection } from "../App";
import { findFieldSource, findRequestSource } from "../lib/evidence";
import { matchRequest, money, requestedParts } from "../lib/review";
import { groupIssues, issueColor } from "../lib/issueClasses";
import { IssueOverview } from "./IssueOverview";
import { EvidenceMark } from "./EvidenceMark";
import { FollowUpFlag } from "./FollowUpFlag";
import type { FieldLink } from "../lib/fieldLinks";
import { EditPencil, OverrideEditor } from "./OverrideEditor";
import { overrideValue, type EditTarget, type OverrideValue } from "../lib/audit";

interface Props {
  editableTargets: EditTarget[];
  editing: EditTarget | null;
  onEdit: (target: EditTarget) => void;
  onSaveEdit: (value: OverrideValue) => void;
  onCancelEdit: () => void;
  fieldLinks: FieldLink[];
  vendor: Vendor;
  model: ThreadModel;
  selection: Selection | null;
  followUpIds: Set<string>;
  addedFollowUpIds: Set<string>;
  onToggleFollowUp: (targetId: string) => void;
  onNavigate: (target: ReviewTarget) => void;
  onSelect: (productId: string, sourceId?: string, targetId?: string, linkId?: string) => void;
}
export function ExtractedPane({
  editableTargets, editing, onEdit, onSaveEdit, onCancelEdit,
  fieldLinks,
  vendor,
  model,
  selection,
  followUpIds,
  addedFollowUpIds,
  onToggleFollowUp,
  onNavigate,
  onSelect,
}: Props) {
  const requests = requestedParts(vendor);
  function editable(target: EditTarget | undefined, content: ReactNode) {
    if (!target) return content;
    const active = editing?.id === target.id;
    return <span className={`field-evidence-actions override-field ${active ? "editing-field" : ""}`}>
      <span className="override-placeholder" aria-hidden={active || undefined} inert={active || undefined}>
        <EditPencil label={target.label} onClick={() => onEdit(target)} />{content}
      </span>
      {active && <OverrideEditor key={target.id} target={target}
        value={overrideValue(vendor, target)} onSave={onSaveEdit} onCancel={onCancelEdit} />}
    </span>;
  }
  function isSourceSelected(sourceId?: string) {
    return !!sourceId && !selection?.linkId && !selection?.targetId && selection?.sourceId === sourceId;
  }
  function plainValue(product: Product, field: string, quantity: number, value: string | number | null) {
    const link = fieldLinks.find(l => l.productId === product.id && l.field === field && l.quantity === quantity);
    const target = editableTargets.find(t => t.productId === product.id && t.field === field && t.quantity === quantity);
    return editable(target, !link ? value : <button id={`field-link-${link.id}`} className={selection?.linkId === link.id ? "selected-linked-value" : ""}
      onClick={() => onSelect(product.id, link.sourceId, undefined, link.id)}>{value}</button>);
  }
  const selectTarget = (target: ReviewTarget) =>
    onSelect(target.productId, target.source?.id, target.id);
  function showSource(product: Product | null, needle: string) {
    onSelect(
      product?.id ?? "",
      findFieldSource(model.sources, vendor, product, needle)?.id,
    );
  }
  function mark(target: ReviewTarget, value: string | number) {
    const canFollowUp = followUpIds.has(target.id);
    const added = addedFollowUpIds.has(target.id);
    return editable(target.category === "missing" ? target : editableTargets.find(t =>
      t.productId === target.productId && t.field === target.field && t.quantity === target.quantity), (
      <span className="field-evidence-actions">
        {canFollowUp && (
          <FollowUpFlag label={target.label} added={added} onToggle={() => onToggleFollowUp(target.id)} />
        )}
        <EvidenceMark
          target={target}
          side="field"
          active={selection?.targetId === target.id}
          onSelect={selectTarget}
        >
          {value}
        </EvidenceMark>
      </span>
    ));
  }
  function field(
    product: Product | null,
    key: string,
    label: string,
    value: string | number | boolean | null,
    needle: string,
    sourceOverride?: SourceLine,
  ) {
    const source =
      sourceOverride ?? findFieldSource(model.sources, vendor, product, needle);
    const target = model.targets.find(
      (target) =>
        target.productId === product?.id &&
        target.field === key &&
        target.quantity === undefined,
    );
    const text =
      value === null || value === ""
        ? "Not stated"
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : value;
    const link = fieldLinks.find(l => l.productId === (product?.id ?? "") && l.field === key && l.quantity === undefined);
    return (
      <div id={link ? `field-link-${link.id}` : undefined}
        className={`field-row ${(link ? selection?.linkId === link.id : isSourceSelected(source?.id)) || (target && selection?.targetId === target.id) ? "source-selected-field" : ""}`}
        data-source-id={source?.id} key={key}>
        <dt>{label}</dt>
        <dd>
          {target ? (
            mark(target, text)
          ) : (
            editable(editableTargets.find(t => t.productId === product?.id && t.field === key && t.quantity === undefined), <button
              disabled={!source}
              onClick={() => onSelect(product?.id ?? "", link?.sourceId ?? source?.id, undefined, link?.id)}
              title={source ? "Show source text" : "No source text available"}
            >
              {text}
            </button>)
          )}
        </dd>
      </div>
    );
  }
  return (
    <aside className="extracted" aria-label="Quotation review">
      {model.targets.length > 0 && <header className="column-header">
        <h2>{model.targets.length} issues to resolve</h2>
      </header>}
      <div className="fields-scroll">
        <IssueOverview targets={model.targets} products={vendor.products} onSelect={onNavigate} />
        <section className="vendor-fields">
          <dl>
            {field(
              null,
              "terms",
              "Payment terms",
              vendor.paymentTerms,
              "terms",
            )}
            {field(
              null,
              "valid",
              "Quote valid",
              vendor.daysQuoteValid === null
                ? null
                : `${vendor.daysQuoteValid} days`,
              "valid",
            )}
            {field(
              null,
              "contact",
              "Contact",
              vendor.vendorContact,
              vendor.contactName,
            )}
          </dl>
          {vendor.additionalNotes && (
            <p className="vendor-notes">{vendor.additionalNotes}</p>
          )}
        </section>
        {vendor.products.map((product) => {
          const request = matchRequest(product, requests);
          const targets = model.targets.filter(
            (target) => target.productId === product.id,
          );
          const identity = targets.find(
            (target) => target.field === "partNumber",
          );
          const noBid = targets.find((target) => target.field === "noBid");
          const missingBreaks = targets.filter(
            (target) =>
              target.field === "quantity" && target.location === "inferred",
          );
          const lineTarget = (field: string, quantity: number) =>
            targets.find(
              (target) =>
                target.field === field && target.quantity === quantity,
            );
          return (
            <section
              key={product.id}
              id={`fields-${product.id}`}
              className={`product-fields ${selection?.productId === product.id ? "selected-product" : ""}`}
            >
              <header className="product-header" id={`part-header-${product.id}`}>
                <div className="part-issue-counts">
                  {groupIssues(targets).map((group) => (
                    <button
                      key={group.key}
                      className={`issue-count ${group.targets.some((target) => target.id === selection?.targetId) ? "active-count" : ""}`}
                      data-issue-class={group.key}
                      data-count={group.count}
                      data-product-id={product.id}
                      aria-label={`${group.count} ${group.label.toLowerCase()} · ${product.partNumber}`}
                      onClick={() => onNavigate(group.targets[0])}
                    >
                      <span
                        className="issue-count-dot"
                        style={{ background: issueColor(group.hue) }}
                        aria-hidden="true"
                      >
                        {group.count}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  className="product-description"
                  onClick={() => showSource(product, product.partNumber)}
                >
                  {product.description}
                </button>
                <div className="product-id">
                  {identity ? (
                    mark(identity, product.partNumber)
                  ) : (
                    <button
                      onClick={() => showSource(product, product.partNumber)}
                    >
                      {product.partNumber}
                    </button>
                  )}
                </div>

              </header>
              <div className="product-content">
              {identity && (
                <p className="identity-context">
                  {request ? (
                    <>
                      Requested:{" "}
                      <button
                        onClick={() =>
                          onSelect(
                            product.id,
                            findRequestSource(
                              model.sources,
                              vendor,
                              request.partNumber,
                            )?.id,
                          )
                        }
                      >
                        {request.partNumber}
                      </button>
                    </>
                  ) : (
                    "Additional stock · not requested"
                  )}
                </p>
              )}
              <dl>
                {field(product, "nsn", "NSN", product.nsn, "NSN")}
                {field(
                  product,
                  "mfrPartNumber",
                  "Manufacturer PN",
                  product.mfrPartNumber,
                  "mfr PN",
                )}
                {field(
                  product,
                  "mfrCage",
                  "Manufacturer CAGE",
                  product.mfrCage,
                  "mfr CAGE",
                )}
                {field(product, "coo", "Country of origin", product.coo, "COO")}
                {field(
                  product,
                  "certifications",
                  "Certifications",
                  product.certifications,
                  "certs",
                )}
                {field(
                  product,
                  "packagingIncluded",
                  "Packaging included",
                  product.packagingIncluded,
                  "packaging",
                )}
                {field(
                  product,
                  "shippingIncluded",
                  "Shipping included",
                  product.shippingIncluded,
                  "shipping",
                )}
                {field(
                  product,
                  "hazmatItem",
                  "Hazmat",
                  product.hazmatItem,
                  "hazmat",
                )}
                {field(
                  product,
                  "nreCost",
                  "NRE",
                  product.nreCost === null
                    ? null
                    : money(
                        product.nreCost,
                        product.lines.find((line) => line.currency)?.currency,
                      ),
                  "NRE",
                )}
              </dl>
              <div className="quantity-heading">
                <strong>Pricing</strong>
                {request && (
                  <span>Requested: {request.quantities.join(" / ")}</span>
                )}
              </div>
              {product.lines.length ? (
                <div className="pricing-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Total</th>
                        <th>Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.lines.map((line) => {
                        const source = findFieldSource(model.sources, vendor, product, `qty ${line.quantity}:`);
                        const selected = isSourceSelected(source?.id);
                        return (
                        <tr key={line.id} data-source-id={source?.id}
                          className={selected ? "source-selected-field" : ""}>
                          <td>
                            {lineTarget("quantity", line.quantity) ? (
                              mark(
                                lineTarget("quantity", line.quantity)!,
                                line.quantity,
                              )
                            ) : (
                              plainValue(product, "quantity", line.quantity, line.quantity)
                            )}
                          </td>
                          <td>
                            {lineTarget("unitCost", line.quantity)
                              ? mark(
                                  lineTarget("unitCost", line.quantity)!,
                                  line.unitCost === null
                                    ? "Missing"
                                    : money(line.unitCost, line.currency),
                                )
                              : plainValue(product, "unitCost", line.quantity, money(line.unitCost, line.currency))}
                            <small className="price-currency">
                              {lineTarget("currency", line.quantity)
                                ? mark(
                                    lineTarget("currency", line.quantity)!,
                                    "Currency?",
                                  )
                                : plainValue(product, "currency", line.quantity, line.currency)}
                            </small>
                          </td>
                          <td>
                            {lineTarget("price", line.quantity)
                              ? mark(
                                  lineTarget("price", line.quantity)!,
                                  line.price === null
                                    ? "Missing"
                                    : money(line.price, line.currency),
                                )
                              : plainValue(product, "price", line.quantity, money(line.price, line.currency))}
                          </td>
                          <td>
                            {lineTarget("leadTime", line.quantity)
                              ? mark(
                                  lineTarget("leadTime", line.quantity)!,
                                  line.leadTime === null
                                    ? "Missing"
                                    : `${line.leadTime}d`,
                                )
                              : plainValue(product, "leadTime", line.quantity, line.leadTime === null
                                ? "Missing"
                                : `${line.leadTime}d`)}
                          </td>
                        </tr>
                      ); })}
                      {missingBreaks.map((target) => (
                        <tr className="missing-break" key={target.id}>
                          <td>{target.quantity}</td>
                          <td>
                            {mark(target, "Not quoted")}
                          </td>
                          <td colSpan={2} className="missing-break-context">
                            <span className="inferred-label">
                              in vendor reply
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : noBid ? (
                <div className="no-pricing">
                  {mark(noBid, "No quote provided")}
                </div>
              ) : (
                <div className="no-pricing">No pricing supplied.</div>
              )}
              {product.additionalNotes && (
                <p className="part-note">{product.additionalNotes}</p>
              )}
              {product.lines
                .filter(
                  (line) => line.additionalNotes || line.isFat || line.variance,
                )
                .map((line) => (
                  <p className="line-note" key={line.id}>
                    <strong>Qty {line.quantity}:</strong> {line.additionalNotes}
                    {line.isFat ? " FAT applies." : ""}
                    {line.variance ? ` Variance ${line.variance}.` : ""}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
