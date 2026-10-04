import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  latestResponse,
  matchRequest,
  requestedParts,
  splitSource,
  validateProduct,
} from "./review.ts";
import type { Vendor } from "./types.ts";
import { applyOverride, overrideValue, validateOverride, formatOverride } from "./audit.ts";
const vendors: Vendor[] = JSON.parse(
  readFileSync(new URL("../data/state.json", import.meta.url), "utf8"),
).vendors;
test("manual overrides validate typed values and preserve source emails", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const vendor = vendors[0];
  const target = buildThreadModel(vendor).targets.find(t => t.field === "unitCost" && t.quantity === 100)!;
  assert.equal(overrideValue(vendor, target), null);
  const updated = applyOverride(vendor, target, validateOverride(target, "1.74"));
  assert.equal(overrideValue(updated, target), 1.74);
  assert.equal(overrideValue(vendor, target), null);
  assert.equal(updated.emails, vendor.emails);
  assert.ok(!buildThreadModel(updated).targets.some(t => t.id === target.id));
  for (const value of ["-1", "NaN", "1,74", "Infinity"]) assert.throws(() => validateOverride(target, value));
  const cleared = applyOverride(updated, target, validateOverride(target, ""));
  assert.equal(overrideValue(cleared, target), null);
  assert.ok(buildThreadModel(cleared).targets.some(t => t.id === target.id));
  assert.equal(validateOverride({ ...target, field: "currency" }, "  "), "");
  assert.equal(validateOverride({ ...target, field: "currency" }, "usd"), "USD");
  assert.throws(() => validateOverride({ ...target, field: "currency" }, "dollar"));
  assert.throws(() => validateOverride({ ...target, field: "leadTime" }, "1.5"));
  assert.throws(() => validateOverride({ ...target, field: "id" }, "x"));
});
test("manual boolean overrides preserve false and text overrides trim input", () => {
  const vendor = structuredClone(vendors[0]);
  vendor.products[0].shippingIncluded = null;
  const target = { id: "manual-test", productId: vendor.products[0].id, field: "shippingIncluded", label: "Shipping missing" };
  const updated = applyOverride(vendor, target, validateOverride(target, "false"));
  assert.equal(overrideValue(updated, target), false);
  assert.equal(overrideValue(applyOverride(updated, target, validateOverride(target, "")), target), null);
  assert.equal(formatOverride(false), "No");
  assert.equal(formatOverride(0), "0");
  assert.equal(formatOverride(null), "Empty");
  assert.throws(() => validateOverride(target, "maybe"));
  assert.equal(validateOverride({ ...target, field: "certifications" }, " C of C "), "C of C");
});
test("RFQ requests retain the original part numbers and quantity breaks", () => {
  for (const vendor of vendors) {
    const requests = requestedParts(vendor);
    assert.equal(requests.length, 10);
    assert.deepEqual(requests[0].quantities, [100, 250, 500]);
  }
});
test("alternate matched by NSN remains flagged, rather than silently treated as exact", () => {
  const vendor = vendors[0];
  const product = vendor.products[1];
  const requests = requestedParts(vendor);
  assert.equal(matchRequest(product, requests)?.partNumber, "NAS1149F0832P");
  assert.deepEqual(
    validateProduct(product, requests).map((i) => i.kind),
    ["alternate"],
  );
});
test("missing extraction and missing quantity are separate findings", () => {
  const vendor = vendors[0];
  const issues = validateProduct(vendor.products[0], requestedParts(vendor));
  assert.ok(
    issues.some((i) => i.kind === "quantity" && i.detail.includes("250")),
  );
  assert.ok(
    issues.some((i) => i.kind === "missing" && i.detail.includes("unit price")),
  );
});
test("no-bid does not produce a misleading cascade of missing fields", () => {
  const vendor = vendors[2];
  assert.deepEqual(
    validateProduct(vendor.products[4], requestedParts(vendor)).map(
      (i) => i.kind,
    ),
    ["no-bid"],
  );
});
test("false boolean values and unstated optional NRE are not missing data", () => {
  const vendor = vendors[0];
  assert.deepEqual(
    validateProduct(vendor.products[2], requestedParts(vendor)),
    [],
  );
});
test("additional stock and unrequested quantity breaks are detected", () => {
  const vendor = vendors[1];
  assert.ok(
    validateProduct(vendor.products[10], requestedParts(vendor)).some(
      (i) => i.kind === "extra",
    ),
  );
  assert.ok(
    validateProduct(vendor.products[3], requestedParts(vendor)).some((i) =>
      i.id.endsWith("extra-breaks"),
    ),
  );
});
test("missing COO is surfaced and latest forwarded revision is selected", () => {
  const vendor = vendors[2];
  assert.ok(
    validateProduct(vendor.products[1], requestedParts(vendor)).some((i) =>
      i.detail.includes("country of origin"),
    ),
  );
  assert.match(latestResponse(vendor).subject, /rev 3/);
});
test("every part is locatable in inline, attachment and forwarded source formats", () => {
  for (const vendor of vendors) {
    const email = latestResponse(vendor);
    const text = email.attachments.length
      ? email.attachments.flatMap((a) => a.pages).join("\n\n")
      : email.body;
    const blocks = splitSource(text);
    assert.equal(blocks.map((b) => b.text).join(""), text);
    for (const product of vendor.products)
      assert.ok(
        blocks.some((block) => block.partNumber === product.partNumber),
        product.partNumber,
      );
  }
});
test("arithmetic rule tolerates cent rounding and flags inconsistent totals", () => {
  const vendor = vendors[0];
  const product = structuredClone(vendor.products[2]);
  product.lines[0].price = 99;
  assert.ok(
    validateProduct(product, requestedParts(vendor)).some(
      (i) => i.kind === "arithmetic",
    ),
  );
});

test("discrepancies point to existing source lines in the full thread", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  for (const vendor of vendors) {
    const model = buildThreadModel(vendor);
    assert.equal(
      new Set(model.sources.map((source) => source.emailId)).size,
      vendor.emails.length,
    );
    const lineIds = new Set(
      model.sources.flatMap((source) =>
        source.blocks.flatMap((block) => block.lines.map((line) => line.id)),
      ),
    );
    for (const finding of model.findings) {
      assert.ok(
        finding.evidence.length > 0,
        `${vendor.name}: ${finding.issue.title}`,
      );
      for (const line of finding.evidence) assert.ok(lineIds.has(line.id));
    }
  }
});

test("missing quantities annotate vendor pricing rather than flagging the original request", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const vendor = vendors[0];
  const model = buildThreadModel(vendor);
  const target = model.targets.find(
    (t) => t.field === "quantity" && t.quantity === 250,
  )!;
  assert.equal(target.location, "inferred");
  assert.ok(target.source?.id.startsWith(latestResponse(vendor).id));
  assert.equal(target.range, undefined);
  assert.match(target.explanation, /missing from the reply/);
  for (const target of model.targets)
    assert.ok(!target.source?.id.startsWith(vendor.emails[0].id));
});

test("each missing extracted commercial field points to its own literal value", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const vendor = vendors[0];
  const model = buildThreadModel(vendor);
  const targets = model.targets.filter(
    (t) => t.productId === vendor.products[0].id && t.quantity === 100,
  );
  assert.equal(targets.length, 4);
  const values = Object.fromEntries(
    targets.map((t) => [t.field, t.source!.text.slice(...t.range!)]),
  );
  assert.deepEqual(values, {
    unitCost: "1,74",
    price: "174,00",
    currency: "USD",
    leadTime: "18",
  });
  assert.equal(new Set(targets.map((t) => t.hue)).size, 1);
});

test("targets have unique IDs, consistent category colors, latest replies, and nonoverlapping spans", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  for (const vendor of vendors) {
    const model = buildThreadModel(vendor);
    assert.equal(
      new Set(model.targets.map((t) => t.id)).size,
      model.targets.length,
    );
    const { issueStyle } = await import("./issueClasses.ts");
    for (const target of model.targets) {
      assert.equal(target.hue, issueStyle(target).hue);
      assert.ok(target.hue < 55 || target.hue >= 160);
    }
    const currentSources = model.sources.filter(
      (s) => s.emailId === latestResponse(vendor).id,
    );
    const ids = new Set(
      currentSources.flatMap((s) =>
        s.blocks.flatMap((b) => b.lines.map((l) => l.id)),
      ),
    );
    for (const target of model.targets) {
      assert.ok(target.source && ids.has(target.source.id));
      if (target.range) {
        assert.ok(target.range[1] > target.range[0]);
        assert.ok(target.range[1] <= target.source.text.length);
        for (const other of model.targets.filter(
          (t) =>
            t.id !== target.id && t.source?.id === target.source?.id && t.range,
        ))
          assert.ok(
            target.range[1] <= other.range![0] ||
              other.range![1] <= target.range[0],
          );
      }
    }
  }
});

test("missing source evidence falls back to a labeled inferred location", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const vendor = structuredClone(vendors[0]);
  vendor.products[0].coo = "";
  vendor.emails[1].body = vendor.emails[1].body.replace("COO U.S.A.;", "");
  const target = buildThreadModel(vendor).targets.find(
    (t) => t.field === "coo",
  )!;
  assert.equal(target.location, "inferred");
  assert.match(target.explanation, /best guess/);
  assert.ok(target.source?.text.includes(vendor.products[0].partNumber));
});

test("malformed seed values remain missing and point to literal evidence for manual correction", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { followUpItems } = await import("./followUp.ts");
  const vendor = vendors[0];
  const model = buildThreadModel(vendor);
  for (const [field, sourceValue, corrected] of [
    ["coo", "U.S.A.", "US"], ["mfrCage", "1 A 2 B 3", "1A2B3"],
    ["unitCost", "1,74", 1.74], ["price", "174,00", 174],
  ] as const) {
    const target = model.targets.find(t => t.productId === vendor.products[0].id && t.field === field)!;
    assert.equal(target.source!.text.slice(...target.range!), sourceValue);
    assert.equal(followUpItems(vendor, model).find(item => item.target.id === target.id)!.destination, "extraction");
    const updated = applyOverride(vendor, target, corrected);
    assert.equal(overrideValue(updated, target), corrected);
    assert.ok(!buildThreadModel(updated).targets.some(t => t.id === target.id));
    assert.equal(updated.emails, vendor.emails);
  }
});

test("vendor follow-up separates extraction gaps from unanswered vendor questions", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { followUpItems, initialFollowUp, draftFollowUp } = await import("./followUp.ts");
  const vendor = vendors[0];
  const items = followUpItems(vendor, buildThreadModel(vendor));
  const unitPrice = items.find((item) => item.target.field === "unitCost")!;
  assert.equal(unitPrice.destination, "extraction");
  assert.match(unitPrice.reason, /1,74/);
  const missingQuantity = items.find((item) => item.target.quantity === 250 && item.target.category === "quantity")!;
  assert.equal(missingQuantity.destination, "vendor");
  const state = initialFollowUp(items);
  assert.ok(state.included.includes(missingQuantity.target.id));
  assert.ok(!state.included.includes(unitPrice.target.id));
  assert.ok(!items.filter((item) => item.target.category === "no-bid" || item.target.category === "extra").some((item) => state.included.includes(item.target.id)));
  const draft = draftFollowUp(vendor, items, [...state.included, unitPrice.target.id]);
  assert.match(draft, /pricing and lead time for 250 units/);
  assert.match(draft, /NAS1149F0832P/);
  assert.doesNotMatch(draft, /confirm unit price/);
  assert.equal(draftFollowUp(vendor, items, []), "");
});

test("vendor header fields link independently and preserve complete email addresses", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { buildFieldLinks } = await import("./fieldLinks.ts");
  for (const vendor of vendors) {
    const model = buildThreadModel(vendor);
    const links = buildFieldLinks(vendor, model).filter(link => link.productId === "");
    assert.deepEqual(links.map(link => link.field), ["terms", "valid", "contact"]);
    const contact = links.find(link => link.field === "contact")!;
    const source = model.sources.flatMap(s => s.blocks.flatMap(b => b.lines)).find(l => l.id === contact.sourceId)!;
    if (source.text.includes(vendor.contactEmail)) {
      assert.ok(source.text.slice(...contact.range).includes(vendor.contactEmail));
    }
  }
});

test("field links split shared source lines without splitting certification values", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { buildFieldLinks } = await import("./fieldLinks.ts");
  const vendor = vendors[0];
  const model = buildThreadModel(vendor);
  const links = buildFieldLinks(vendor, model).filter(link => link.productId === vendor.products[0].id);
  const cert = links.find(link => link.field === "certifications")!;
  const source = model.sources.flatMap(s => s.blocks.flatMap(b => b.lines)).find(l => l.id === cert.sourceId)!;
  assert.equal(source.text.slice(...cert.range), "certs C of C; DFARS");
  const shared = links.filter(link => link.sourceId === cert.sourceId);
  assert.deepEqual(new Set(shared.map(link => link.field)), new Set(["certifications", "packagingIncluded", "shippingIncluded", "nreCost"]));
  for (const left of shared) for (const right of shared) {
    if (left === right) continue;
    assert.ok(left.range[1] <= right.range[0] || right.range[1] <= left.range[0]);
  }
});

test("field links have unique, literal, nonoverlapping spans alongside existing issue markers", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { buildFieldLinks } = await import("./fieldLinks.ts");
  for (const vendor of vendors) {
    const model = buildThreadModel(vendor);
    const links = buildFieldLinks(vendor, model);
    assert.equal(new Set(links.map(l => l.id)).size, links.length);
    const spans = [...links, ...model.targets.filter(t => t.range).map(t => ({ sourceId: t.source!.id, range: t.range! }))];
    for (const link of links) {
      const source = model.sources.flatMap(s => s.blocks.flatMap(b => b.lines)).find(l => l.id === link.sourceId)!;
      assert.ok(source && link.range[0] >= 0 && link.range[1] <= source.text.length && link.range[0] < link.range[1]);
      for (const span of spans) if (span !== link && span.sourceId === link.sourceId) {
        assert.ok(link.range[1] <= span.range[0] || span.range[1] <= link.range[0], link.id);
      }
    }
  }
});

test("vendor follow-up treats explicit unknown source values as vendor questions", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { followUpItems, initialFollowUp } = await import("./followUp.ts");
  const vendor = vendors[2];
  const items = followUpItems(vendor, buildThreadModel(vendor));
  const origin = items.find((item) => item.target.field === "coo")!;
  assert.equal(origin.destination, "vendor");
  assert.ok(initialFollowUp(items).included.includes(origin.target.id));
  assert.match(origin.question, /country of origin/);
  assert.equal(followUpItems(vendors[3], buildThreadModel(vendors[3])).length, 0);
});
