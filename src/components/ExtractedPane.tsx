import { useEffect, useRef } from "react";
import type { Product, Vendor } from "../lib/types";
import type { ThreadModel, SourceLine, ReviewTarget } from "../lib/evidence";
import type { Selection } from "../App";
import { findFieldSource, findRequestSource } from "../lib/evidence";
import { matchRequest, money, requestedParts } from "../lib/review";
import { groupIssues, issueColor } from "../lib/issueClasses";
import { IssueOverview } from "./IssueOverview";
import { centerInPane } from "../lib/scroll";
import { EvidenceMark } from "./EvidenceMark";

interface Props {
  vendor: Vendor;
  model: ThreadModel;
  selection: Selection | null;
  onSelect: (productId: string, sourceId?: string, targetId?: string) => void;
}
export function ExtractedPane({ vendor, model, selection, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const requests = requestedParts(vendor);
  useEffect(() => {
    if (!selection || (!selection.targetId && selection.origin !== "source"))
      return;
    const scroll = scrollRef.current;
    const target = document.getElementById(
      selection.targetId
        ? `field-target-${selection.targetId}`
        : `fields-${selection.productId}`,
    );
    if (scroll && target) centerInPane(scroll, target);
  }, [selection]);
  const selectTarget = (target: ReviewTarget) =>
    onSelect(target.productId, target.source?.id, target.id);
  function showSource(product: Product | null, needle: string) {
    onSelect(
      product?.id ?? "",
      findFieldSource(model.sources, vendor, product, needle)?.id,
    );
  }
  function mark(target: ReviewTarget, value: string | number) {
    return (
      <EvidenceMark
        target={target}
        side="field"
        active={selection?.targetId === target.id}
        onSelect={selectTarget}
      >
        {value}
      </EvidenceMark>
    );
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
    return (
      <div className="field-row" key={key}>
        <dt>{label}</dt>
        <dd>
          {target ? (
            mark(target, text)
          ) : (
            <button
              disabled={!source}
              onClick={() => onSelect(product?.id ?? "", source?.id)}
              title={source ? "Show source text" : "No source text available"}
            >
              {text}
            </button>
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
      <div className="fields-scroll" ref={scrollRef}>
        <IssueOverview targets={model.targets} products={vendor.products} onSelect={selectTarget} />
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
              <header className="product-header">
                <div className="part-issue-counts">
                  {groupIssues(targets).map((group) => (
                    <button
                      key={group.key}
                      className={`issue-count ${group.targets.some((target) => target.id === selection?.targetId) ? "active-count" : ""}`}
                      data-issue-class={group.key}
                      data-count={group.count}
                      data-product-id={product.id}
                      aria-label={`${group.count} ${group.label.toLowerCase()} · ${product.partNumber}`}
                      onClick={() => selectTarget(group.targets[0])}
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
                      {product.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {lineTarget("quantity", line.quantity) ? (
                              mark(
                                lineTarget("quantity", line.quantity)!,
                                line.quantity,
                              )
                            ) : (
                              <button
                                onClick={() =>
                                  showSource(product, `qty ${line.quantity}:`)
                                }
                              >
                                {line.quantity}
                              </button>
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
                              : money(line.unitCost, line.currency)}
                            <small className="price-currency">
                              {lineTarget("currency", line.quantity)
                                ? mark(
                                    lineTarget("currency", line.quantity)!,
                                    "Currency?",
                                  )
                                : line.currency}
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
                              : money(line.price, line.currency)}
                          </td>
                          <td>
                            {lineTarget("leadTime", line.quantity)
                              ? mark(
                                  lineTarget("leadTime", line.quantity)!,
                                  line.leadTime === null
                                    ? "Missing"
                                    : `${line.leadTime}d`,
                                )
                              : line.leadTime === null
                                ? "Missing"
                                : `${line.leadTime}d`}
                          </td>
                        </tr>
                      ))}
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
            </section>
          );
        })}
      </div>
    </aside>
  );
}
