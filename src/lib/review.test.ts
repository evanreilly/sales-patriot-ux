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
const vendors: Vendor[] = JSON.parse(
  readFileSync(new URL("../data/state.json", import.meta.url), "utf8"),
).vendors;
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
    unitCost: "1.74",
    price: "174.00",
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
  vendor.emails[1].body = vendor.emails[1].body.replace("COO US;", "");
  const target = buildThreadModel(vendor).targets.find(
    (t) => t.field === "coo",
  )!;
  assert.equal(target.location, "inferred");
  assert.match(target.explanation, /best guess/);
  assert.ok(target.source?.text.includes(vendor.products[0].partNumber));
});

test("vendor follow-up separates extraction gaps from unanswered vendor questions", async () => {
  const { buildThreadModel } = await import("./evidence.ts");
  const { followUpItems, initialFollowUp, draftFollowUp } = await import("./followUp.ts");
  const vendor = vendors[0];
  const items = followUpItems(vendor, buildThreadModel(vendor));
  const unitPrice = items.find((item) => item.target.field === "unitCost")!;
  assert.equal(unitPrice.destination, "extraction");
  assert.match(unitPrice.reason, /1\.74/);
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
