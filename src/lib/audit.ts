import type { Vendor } from "./types.ts";
import type { ReviewTarget } from "./evidence.ts";

export type OverrideValue = string | number | boolean | null;
export type EditTarget = Pick<ReviewTarget, "id" | "productId" | "field" | "quantity" | "label">;
export interface AuditEvent {
  id: string;
  vendorId: string;
  at: string;
  kind: "edit" | "email-handoff" | "email-sent" | "follow-up";
  title: string;
  detail: string;
  target?: EditTarget;
  before?: OverrideValue | null;
  after?: OverrideValue;
  body?: string;
}
export const auditStorageKey = "quote-review-audit-v1";
const productFields = ["nsn", "coo", "mfrCage", "mfrPartNumber", "certifications", "packagingIncluded", "shippingIncluded", "hazmatItem"];
const lineFields = ["unitCost", "price", "currency", "leadTime"];
export const booleanFields = ["packagingIncluded", "shippingIncluded", "hazmatItem"];
export function overrideValue(vendor: Vendor, target: EditTarget): OverrideValue | null {
  const product = vendor.products.find(p => p.id === target.productId);
  const record = target.quantity === undefined ? product : product?.lines.find(l => l.quantity === target.quantity);
  return (record as unknown as Record<string, OverrideValue> | undefined)?.[target.field] ?? null;
}
export function validateOverride(target: EditTarget, input: string): OverrideValue {
  if (!(target.quantity === undefined ? productFields : lineFields).includes(target.field)) throw new Error("This field cannot be overridden.");
  const value = input.trim();
  if (!value) return booleanFields.includes(target.field) || ["unitCost", "price", "leadTime"].includes(target.field) ? null : "";
  if (booleanFields.includes(target.field)) {
    if (value !== "true" && value !== "false") throw new Error("Choose Yes or No.");
    return value === "true";
  }
  if (["unitCost", "price", "leadTime"].includes(target.field)) {
    if (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) throw new Error("Enter a non-negative number, using a decimal point.");
    if (target.field === "leadTime" && !Number.isInteger(Number(value))) throw new Error("Enter a whole number of days.");
    return Number(value);
  }
  if (target.field === "currency" && !/^[A-Z]{3}$/i.test(value)) throw new Error("Enter a three-letter currency code, e.g. USD.");
  return ["currency", "coo", "mfrCage"].includes(target.field) ? value.toUpperCase() : value;
}
export function applyOverride(vendor: Vendor, target: EditTarget, value: OverrideValue): Vendor {
  const parsed = validateOverride(target, value === null ? "" : String(value));
  return { ...vendor, products: vendor.products.map(product => product.id !== target.productId ? product :
    target.quantity === undefined ? { ...product, [target.field]: parsed } :
      { ...product, lines: product.lines.map(line => line.quantity !== target.quantity ? line : { ...line, [target.field]: parsed }) }) };
}
export function formatOverride(value: OverrideValue | null | undefined) {
  return value === undefined || value === null || value === "" ? "Empty" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value);
}

export function readAudit(): AuditEvent[] {
  const raw = localStorage.getItem(auditStorageKey);
  if (!raw) return [];
  const events = JSON.parse(raw) as AuditEvent[];
  if (!Array.isArray(events) || events.some(e => !e || typeof e.id !== "string" || typeof e.vendorId !== "string" || !Number.isFinite(Date.parse(e.at)) || typeof e.title !== "string" || typeof e.detail !== "string" || !["edit", "email-handoff", "email-sent", "follow-up"].includes(e.kind))) throw new Error("Invalid saved audit.");
  for (const event of events) if (event.kind === "edit") {
    if (!event.target || event.after === undefined) throw new Error("Invalid saved edit.");
    validateOverride(event.target, event.after === null ? "" : String(event.after));
  }
  return events;
}
