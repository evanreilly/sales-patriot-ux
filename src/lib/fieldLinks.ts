import { findFieldSource, type ThreadModel } from "./evidence.ts";
import type { Product, Vendor } from "./types.ts";

export interface FieldLink {
  id: string;
  productId: string;
  field: string;
  quantity?: number;
  sourceId: string;
  range: [number, number];
}

// Literal spans in the current vendor reply; never inferred positions or earlier revisions.
export function buildFieldLinks(vendor: Vendor, model: ThreadModel): FieldLink[] {
  const links: FieldLink[] = [];
  function add(product: Product | null, field: string, needle: string, pattern: RegExp, quantity?: number, group = 0) {
    const source = findFieldSource(model.sources, vendor, product, needle);
    const range = source && pattern.exec(source.text)?.indices?.[group];
    if (!source || !range) return;
    if (model.targets.some(t => t.productId === product?.id && t.field === field && t.quantity === quantity)) return;
    links.push({ id: `${product?.id ?? vendor.id}:${field}:${quantity ?? ""}`, productId: product?.id ?? "",
      field, quantity, sourceId: source.id, range });
  }
  add(null, "terms", "terms", /\b(?:payment\s+)?terms\b[^\n]*?(?=\.\s+(?:quote\s+valid|valid|contact)\b|\.\s*$|$)/di);
  add(null, "valid", "valid", /\b(?:quote\s+)?valid\b[^\n]*?(?=\.\s+(?:contact|payment\s+terms|terms)\b|\.\s*$|$)/di);
  // Do not split contact details at periods within email addresses.
  add(null, "contact", "contact", /\b(?:use\s+[^.]*\bcontact\b[^.]*|(?:vendor\s+)?contact\b[^\n]*?(?=\.\s+(?:payment\s+terms|terms|quote\s+valid)\b|\.\s*$|$))/di);
  for (const product of vendor.products) {
    for (const [field, needle] of Object.entries({ nsn: "NSN", mfrPartNumber: "mfr PN", mfrCage: "mfr CAGE",
      coo: "COO", certifications: "certs", packagingIncluded: "packaging", shippingIncluded: "shipping", hazmatItem: "hazmat", nreCost: "NRE" })) {
      // A semicolon can also separate certification values (e.g. C of C; FAA 8130).
      add(product, field, needle, new RegExp(`\\b${needle}\\b[^\\n]*?(?=;\\s*(?:NSN|mfr PN|mfr CAGE|COO|certs|packaging|shipping|hazmat|NRE)\\b|$)`, "di"));
    }
    for (const line of product.lines) {
      const pattern = /qty\s+(\d+):\s+([A-Z]{3})\s+([\d.,]+)\s+ea\s*\/\s*([\d.,]+)\s+ext\s*\/\s*(\d+d)/di;
      ["quantity", "currency", "unitCost", "price", "leadTime"].forEach((field, index) =>
        add(product, field, `qty ${line.quantity}:`, pattern, line.quantity, index + 1));
    }
  }
  return links;
}
