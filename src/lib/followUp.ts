import type { ReviewTarget, ThreadModel } from "./evidence.ts";
import type { Product, Vendor } from "./types.ts";
import { matchRequest, requestedParts } from "./review.ts";

export interface FollowUpItem {
  target: ReviewTarget;
  product: Product;
  destination: "vendor" | "extraction";
  reason: string;
  question: string;
  recommended: boolean;
}
export interface FollowUpState {
  included: string[];
  body: string | null;
  draftedIds: string[];
}
const FIELD_NAMES: Record<string, string> = {
  coo: "country of origin", nsn: "NSN", mfrCage: "manufacturer CAGE",
  mfrPartNumber: "manufacturer part number", certifications: "certifications",
  packagingIncluded: "whether packaging is included", shippingIncluded: "whether shipping is included",
  hazmatItem: "hazmat status", unitCost: "unit price", price: "extended price",
  currency: "currency", leadTime: "lead time",
};

// Fixture-based suggestions, not an automatic judgment that the vendor is wrong.
export function followUpItems(vendor: Vendor, model: ThreadModel): FollowUpItem[] {
  const requests = requestedParts(vendor);
  return model.targets.map((target) => {
    const product = vendor.products.find((p) => p.id === target.productId)!;
    const request = matchRequest(product, requests);
    const sourceValue = target.range && target.source
      ? target.source.text.slice(...target.range).trim() : "";
    const sourceHasValue = !!sourceValue && !/not stated|unknown|not provided|n\/a|tbd/i.test(sourceValue);
    const internal = target.category === "arithmetic" || (target.category === "missing" && sourceHasValue);
    let question = "";
    let recommended = true;
    switch (target.category) {
      case "quantity":
        if (target.issueId.endsWith(":extra-breaks")) {
          question = `Could you clarify the additional ${target.quantity}-unit price tier? We requested ${request?.quantities.join(" / ")} units.`;
          recommended = false;
        } else question = `Could you provide pricing and lead time for ${target.quantity} units?`;
        break;
      case "alternate":
        question = `We requested ${request?.partNumber}, but received a quote for ${product.partNumber}. Could you quote the requested part, or confirm the alternate's equivalence and provide supporting details?`;
        break;
      case "no-bid":
        question = "We noted your no-bid. Could you confirm whether this part may become available and, if so, when?";
        recommended = false;
        break;
      case "extra":
        question = "This part was not on our RFQ. Could you confirm whether it was included intentionally and keep it separate from the requested items?";
        recommended = false;
        break;
      case "missing":
        question = `Could you confirm ${FIELD_NAMES[target.field] ?? target.field}${target.quantity === undefined ? "" : ` for ${target.quantity} units`}?`;
        break;
      case "arithmetic":
        recommended = false;
        break;
    }
    return {
      target, product, question, recommended: !internal && recommended,
      destination: internal ? "extraction" : "vendor",
      reason: internal
        ? target.category === "arithmetic" ? "Check the extracted total against the source before contacting the vendor."
          : `The reply contains “${sourceValue}”. Check the extraction first.`
        : target.category === "no-bid" ? "The vendor explicitly declined. Follow up only if needed."
          : target.category === "extra" ? "Additional stock offered; follow-up is optional."
            : target.category === "missing" ? "The value could not be confirmed in the reply. Review the source before asking."
              : target.explanation,
    };
  });
}
export function initialFollowUp(items: FollowUpItem[]): FollowUpState {
  const included = items.filter((item) => item.recommended).map((item) => item.target.id);
  return { included, body: null, draftedIds: included };
}
export function draftFollowUp(vendor: Vendor, items: FollowUpItem[], included: string[]): string {
  const selected = items.filter((item) => item.destination === "vendor" && included.includes(item.target.id));
  if (!selected.length) return "";
  const groups = new Map<string, FollowUpItem[]>();
  for (const item of selected) groups.set(item.product.id, [...(groups.get(item.product.id) ?? []), item]);
  const questions = [...groups.values()].map((group) => {
    const product = group[0].product;
    return `${product.partNumber} — ${product.description}\n${group.map((item) => `• ${item.question}`).join("\n")}`;
  }).join("\n\n");
  return `Hi ${vendor.contactName.split(" ")[0]},\n\nThanks for sending your quote. Could you help us clarify the following?\n\n${questions}\n\nThank you,\nArgus Defense RFQ Desk`;
}
