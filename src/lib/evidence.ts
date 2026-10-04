import { issueStyle } from "./issueClasses.ts";
import {
  latestResponse,
  matchRequest,
  requestedParts,
  splitSource,
  validateProduct,
} from "./review.ts";
import type { Issue, Product, Vendor } from "./types.ts";

export interface SourceLine {
  id: string;
  text: string;
}
export interface SourceSection {
  id: string;
  emailId: string;
  attachmentName?: string;
  page?: number;
  blocks: { partNumber?: string; lines: SourceLine[] }[];
}
export interface ReviewTarget {
  id: string;
  issueId: string;
  category: Issue["kind"];
  productId: string;
  field: string;
  quantity?: number;
  label: string;
  explanation: string;
  source?: SourceLine;
  range?: [number, number];
  location: "exact" | "inferred";
  number: number;
  hue: number;
}
export interface Finding {
  issue: Issue;
  evidence: SourceLine[];
  targets: ReviewTarget[];
}
export interface ThreadModel {
  sources: SourceSection[];
  findings: Finding[];
  targets: ReviewTarget[];
}

export function threadSources(vendor: Vendor): SourceSection[] {
  return vendor.emails.flatMap((email) => {
    const texts = [
      { id: email.id, emailId: email.id, text: email.body },
      ...email.attachments.flatMap((attachment) =>
        attachment.pages.map((text, page) => ({
          id: `${attachment.id}-${page}`,
          emailId: email.id,
          attachmentName: attachment.filename,
          page: page + 1,
          text,
        })),
      ),
    ];
    return texts.map(({ text, ...source }) => ({
      ...source,
      blocks: splitSource(text).map((block, blockIndex) => ({
        partNumber: block.partNumber,
        lines: block.text
          .replace(/\n$/, "")
          .split("\n")
          .map((text, lineIndex) => ({
            id: `${source.id}-${blockIndex}-${lineIndex}`,
            text,
          })),
      })),
    }));
  });
}

export function findFieldSource(
  sources: SourceSection[],
  vendor: Vendor,
  product: Product | null,
  needle: string,
): SourceLine | undefined {
  const reply = latestResponse(vendor);
  const blocks = sources
    .filter((source) => source.emailId === reply.id)
    .flatMap((source) => source.blocks)
    .filter((block) => !product || block.partNumber === product.partNumber);
  return blocks
    .flatMap((block) => block.lines)
    .find((line) => line.text.toLowerCase().includes(needle.toLowerCase()));
}

export function findRequestSource(
  sources: SourceSection[],
  vendor: Vendor,
  partNumber: string,
): SourceLine | undefined {
  return sources
    .filter(
      (source) =>
        vendor.emails.find((email) => email.id === source.emailId)?.from !==
        vendor.contactEmail,
    )
    .flatMap((source) => source.blocks)
    .filter((block) => block.partNumber === partNumber)
    .flatMap((block) => block.lines)
    .find((line) => line.text.includes("requested qty breaks"));
}

// Source ranges identify literal text. An inferred target is a separate review note,
// never a highlight on unrelated text or a fabricated line in the vendor's email.
function capture(
  line: SourceLine | undefined,
  pattern: RegExp,
  group = 1,
): [number, number] | undefined {
  return line ? pattern.exec(line.text)?.indices?.[group] : undefined;
}

export function buildThreadModel(vendor: Vendor): ThreadModel {
  const sources = threadSources(vendor);
  const requests = requestedParts(vendor);
  let ordinal = 0;
  const findings = vendor.products.flatMap((product) =>
    validateProduct(product, requests).map((issue) => {
      const request = matchRequest(product, requests);
      const replyBlocks = sources
        .filter((source) => source.emailId === latestResponse(vendor).id)
        .flatMap((source) => source.blocks);
      const block = replyBlocks.find(
        (block) => block.partNumber === product.partNumber,
      );
      const heading = block?.lines.find((line) => line.text.trim());
      const pricing =
        block?.lines.filter((line) => /^\s*qty\s+\d+:/.test(line.text)) ?? [];
      const targets: ReviewTarget[] = [];
      const fieldSource = (needle: string) =>
        findFieldSource(sources, vendor, product, needle);
      function add(
        field: string,
        label: string,
        explanation: string,
        source?: SourceLine,
        range?: [number, number],
        quantity?: number,
      ) {
        const number = ++ordinal;
        targets.push({
          id: `${issue.id}:${field}${quantity === undefined ? "" : `-${quantity}`}`,
          issueId: issue.id,
          category: issue.kind,
          productId: product.id,
          field,
          quantity,
          label,
          explanation,
          source:
            source ??
            heading ??
            replyBlocks
              .flatMap((block) => block.lines)
              .find((line) => line.text.trim()),
          range,
          location: range ? "exact" : "inferred",
          number,
          // Keep classes consistent across vendors; green is reserved for success.
          hue: issueStyle({ category: issue.kind, field }).hue,
        });
      }
      if (issue.id.endsWith(":breaks")) {
        const quoted = product.lines
          .filter((line) => line.isQuoting)
          .map((line) => line.quantity);
        for (const qty of request?.quantities.filter(
          (qty) => !quoted.includes(qty),
        ) ?? []) {
          add(
            "quantity",
            `Qty ${qty} not quoted`,
            `The original request includes ${request!.quantities.join(", ")} units. This vendor reply quotes ${quoted.join(", ")} only; the ${qty}-unit price break is missing from the reply. The marked position is an inferred place in the vendor's pricing section, not missing text in your request. Ask the vendor for this price break.`,
            pricing.at(-1) ?? heading,
            undefined,
            qty,
          );
        }
      } else if (issue.kind === "no-bid") {
        const source = fieldSource("NO QUOTE");
        add(
          "noBid",
          "No quote provided",
          `The vendor explicitly declined to quote ${product.partNumber}. The original request is complete; no pricing was supplied in this response. Confirm whether to follow up or accept the no-bid.`,
          source,
          capture(source, /(NO QUOTE[^\n]*)/d),
        );
      } else if (issue.id.endsWith(":fields")) {
        const fields: [keyof Product, string, string, RegExp][] = [
          ["nsn", "NSN", "NSN", /NSN\s+([^\n;]+)/d],
          ["coo", "Country of origin", "COO", /COO\s+([^;\n]+)/d],
          ["mfrCage", "Manufacturer CAGE", "mfr CAGE", /mfr CAGE\s+([^;\n]+)/d],
          [
            "mfrPartNumber",
            "Manufacturer part",
            "mfr PN",
            /mfr PN\s+([^;\n]+)/d,
          ],
          ["certifications", "Certifications", "certs", /certs\s+([^;\n]+)/d],
          [
            "packagingIncluded",
            "Packaging",
            "packaging",
            /packaging\s+([^;\n]+)/d,
          ],
          ["shippingIncluded", "Shipping", "shipping", /shipping\s+([^;\n]+)/d],
          ["hazmatItem", "Hazmat", "hazmat", /hazmat\s+([^;\n]+)/d],
        ];
        for (const [key, label, needle, pattern] of fields)
          if (product[key] === null || product[key] === "") {
            const source = fieldSource(needle);
            const range = capture(source, pattern);
            const text = range ? source!.text.slice(...range) : "";
            const explanation =
              text && !/not stated|unknown/i.test(text)
                ? `The extracted ${label.toLowerCase()} is empty, but the vendor's text says "${text}". Check this source value and fill the extraction if correct.`
                : text
                  ? `The vendor explicitly says "${text}" for ${label.toLowerCase()}. The value is not provided, so it cannot be extracted. Ask the vendor to confirm it.`
                  : `No ${label.toLowerCase()} was extracted and no matching value was found in this part's vendor quote. The marked location is our best guess within the part details. Ask the vendor to supply it.`;
            add(key, `${label} missing`, explanation, source, range);
          }
      } else if (issue.id.includes(":line-") || issue.id.includes(":total-")) {
        const line = product.lines.find((line) => issue.id.endsWith(line.id))!;
        const source = fieldSource(`qty ${line.quantity}:`);
        const pattern =
          /qty\s+\d+:\s+([A-Z]{3})\s+([\d.,]+)\s+ea\s*\/\s*([\d.,]+)\s+ext\s*\/\s*(\d+)d/d;
        const fields = [
          ["unitCost", "Unit price", 2],
          ["price", "Extended price", 3],
          ["currency", "Currency", 1],
          ["leadTime", "Lead time", 4],
        ] as const;
        for (const [key, label, group] of fields) {
          if (
            issue.kind === "arithmetic"
              ? key !== "price"
              : line[key] !== null && line[key] !== ""
          )
            continue;
          const range = capture(source, pattern, group);
          const text = range ? source!.text.slice(...range) : "";
          const explanation =
            issue.kind === "arithmetic"
              ? `For qty ${line.quantity}, the extracted total ${line.price} does not match ${line.quantity} × ${line.unitCost}. Compare the vendor's extended price before correcting the extraction.`
              : `The saved extraction has no ${label.toLowerCase()} for qty ${line.quantity}. ${text ? `The vendor's reply appears to supply "${text}${key === "leadTime" ? " days" : ""}" here. Review it and fill the extracted field.` : `We could not locate a matching value. This is an inferred position in the vendor's pricing section; confirm the value with the vendor.`}`;
          add(
            key,
            `${label} ${issue.kind === "arithmetic" ? "mismatch" : "not extracted"} · qty ${line.quantity}`,
            explanation,
            source ?? pricing.at(-1),
            range,
            line.quantity,
          );
        }
      } else if (issue.id.endsWith(":extra-breaks")) {
        for (const line of product.lines.filter(
          (line) => !request?.quantities.includes(line.quantity),
        )) {
          const source = fieldSource(`qty ${line.quantity}:`);
          add(
            "quantity",
            `Extra qty ${line.quantity}`,
            `The vendor quoted ${line.quantity} units, but the requested breaks are ${request?.quantities.join(", ")}. Confirm whether this additional break is useful.`,
            source,
            capture(source, /qty\s+(\d+):/d),
            line.quantity,
          );
        }
      } else {
        const source = heading;
        const start = source?.text.indexOf(product.partNumber) ?? -1;
        add(
          "partNumber",
          issue.title,
          issue.detail,
          source,
          start < 0 ? undefined : [start, start + product.partNumber.length],
        );
      }
      return {
        issue,
        targets,
        evidence: [
          ...new Map(
            targets
              .filter((t) => t.source)
              .map((t) => [t.source!.id, t.source!]),
          ).values(),
        ],
      };
    }),
  );
  return { sources, findings, targets: findings.flatMap((f) => f.targets) };
}
