import type {
  Email,
  Issue,
  Product,
  RequestedPart,
  SourceBlock,
  Vendor,
} from "./types.ts";

// Fixture adapter: replace this parser with backend RFQ records when available.
export function requestedParts(vendor: Vendor): RequestedPart[] {
  const request = vendor.emails.find(
    (email) =>
      email.from !== vendor.contactEmail &&
      /requested qty breaks/.test(email.body),
  );
  return [
    ...(request?.body ?? "").matchAll(
      /^\d+\.\s+(\S+)\s+\| NSN ([\d-]+) \| requested qty breaks ([\d/]+)/gm,
    ),
  ].map((match) => ({
    partNumber: match[1],
    nsn: match[2],
    quantities: match[3].split("/").map(Number),
  }));
}
export function matchRequest(product: Product, requests: RequestedPart[]) {
  return (
    requests.find((part) => part.partNumber === product.partNumber) ??
    requests.find((part) => part.nsn === product.nsn && !!part.nsn)
  );
}

// Rules are pure and independent of UI. Each stable issue ID can hold a review decision.
export function validateProduct(
  product: Product,
  requests: RequestedPart[],
): Issue[] {
  const issues: Issue[] = [];
  const add = (
    kind: Issue["kind"],
    key: string,
    title: string,
    detail: string,
  ) =>
    issues.push({
      id: `${product.id}:${key}`,
      productId: product.id,
      kind,
      title,
      detail,
    });
  const request = matchRequest(product, requests);
  if (!request)
    add(
      "extra",
      "extra",
      "Unrequested part",
      "This part is additional stock and was not included in the original RFQ.",
    );
  else if (request.partNumber !== product.partNumber)
    add(
      "alternate",
      "alternate",
      "Alternate part number",
      `Requested ${request.partNumber}; vendor quoted ${product.partNumber}. Matched by NSN. Confirm that this alternate is acceptable.`,
    );
  const quoted = product.lines.filter((line) => line.isQuoting);
  if (!quoted.length) {
    add(
      "no-bid",
      "no-bid",
      "No quote provided",
      "The vendor has not supplied pricing for this requested part.",
    );
    return issues;
  }
  if (request) {
    const missing = request.quantities.filter(
      (qty) => !quoted.some((line) => line.quantity === qty),
    );
    if (missing.length)
      add(
        "quantity",
        "breaks",
        "Missing quantity breaks",
        `Requested quantities ${missing.join(", ")} have no quoted price break.`,
      );
    const extra = quoted
      .filter((line) => !request.quantities.includes(line.quantity))
      .map((line) => line.quantity);
    if (extra.length)
      add(
        "quantity",
        "extra-breaks",
        "Additional quantity breaks",
        `The vendor also quoted quantities ${extra.join(", ")} that were not requested.`,
      );
  }
  const required: [keyof Product, string][] = [
    ["nsn", "NSN"],
    ["coo", "country of origin"],
    ["mfrCage", "manufacturer CAGE"],
    ["mfrPartNumber", "manufacturer part number"],
    ["certifications", "certifications"],
    ["packagingIncluded", "packaging"],
    ["shippingIncluded", "shipping"],
    ["hazmatItem", "hazmat status"],
  ];
  const missing = required
    .filter(([key]) => product[key] === null || product[key] === "")
    .map(([, label]) => label);
  if (missing.length)
    add(
      "missing",
      "fields",
      "Missing product fields",
      `Not extracted: ${missing.join(", ")}. Check the source before following up.`,
    );
  for (const line of quoted) {
    const fields = [
      ["unitCost", "unit price"],
      ["price", "extended price"],
      ["currency", "currency"],
      ["leadTime", "lead time"],
    ] as const;
    const absent = fields
      .filter(([key]) => line[key] === null || line[key] === "")
      .map(([, label]) => label);
    if (absent.length)
      add(
        "missing",
        `line-${line.id}`,
        `Incomplete extraction · qty ${line.quantity}`,
        `Not extracted: ${absent.join(", ")}. These values may still be present in the source.`,
      );
    if (
      line.unitCost !== null &&
      line.price !== null &&
      Math.abs(line.unitCost * line.quantity - line.price) > 0.011
    )
      add(
        "arithmetic",
        `total-${line.id}`,
        `Price mismatch · qty ${line.quantity}`,
        "Quantity × unit price does not match the extracted extended price.",
      );
  }
  return issues;
}
export function latestResponse(vendor: Vendor): Email {
  return (
    [...vendor.emails]
      .filter((email) => email.from === vendor.contactEmail)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ??
    vendor.emails[vendor.emails.length - 1]
  );
}
export function splitSource(text: string): SourceBlock[] {
  return text
    .split(/(?=^\d+[.)]\s+\S+)/m)
    .filter(Boolean)
    .map((text) => ({ text, partNumber: text.match(/^\d+[.)]\s+(\S+)/)?.[1] }));
}
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export const money = (value: number | null, currency = "USD") =>
  value === null
    ? "Missing"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      }).format(value);
