import type { Issue } from "./types.ts";

export interface IssueStyle {
  key: string;
  label: string;
  hue: number;
}
// Category colors stay consistent across threads, fields and source text.
export const ISSUE_CLASSES: Record<Issue["kind"], Omit<IssueStyle, "key">> = {
  quantity: { label: "Quantity breaks", hue: 28 },
  missing: { label: "Missing fields", hue: 230 },
  alternate: { label: "Alternate parts", hue: 165 },
  "no-bid": { label: "No quote", hue: 50 },
  extra: { label: "Extra parts", hue: 300 },
  arithmetic: { label: "Price mismatch", hue: 20 },
};
export const ISSUE_CLASS_ORDER: Issue["kind"][] = [
  "quantity",
  "missing",
  "alternate",
  "no-bid",
  "extra",
  "arithmetic",
];
const MISSING_FIELD_LABELS: Record<string, string> = {
  unitCost: "Missing unit price",
  price: "Missing total",
  currency: "Missing currency",
  leadTime: "Missing lead time",
  coo: "Missing origin",
  nsn: "Missing NSN",
  mfrCage: "Missing CAGE",
  mfrPartNumber: "Missing mfr part",
  certifications: "Missing certifications",
  packagingIncluded: "Missing packaging",
  shippingIncluded: "Missing shipping",
  hazmatItem: "Missing hazmat status",
};
export function issueStyle(target: {
  category: Issue["kind"];
  field: string;
}): IssueStyle {
  if (target.category === "missing")
    return {
      key: `missing:${target.field}`,
      ...ISSUE_CLASSES.missing,
      label: MISSING_FIELD_LABELS[target.field] ?? ISSUE_CLASSES.missing.label,
    };
  return { key: target.category, ...ISSUE_CLASSES[target.category] };
}
export function issueColor(hue: number) {
  if (hue === ISSUE_CLASSES["no-bid"].hue) return `hsl(${hue} 95% 48%)`;
  if (hue === ISSUE_CLASSES.quantity.hue) return `hsl(${hue} 95% 40%)`;
  return `hsl(${hue} 82% 35%)`;
}
export function issueTextColor(hue: number) {
  return hue === ISSUE_CLASSES["no-bid"].hue ? "#756000" : issueColor(hue);
}
export function groupIssues<
  T extends { category: Issue["kind"]; field: string },
>(targets: T[]) {
  const groups = new Map<
    string,
    IssueStyle & { targets: T[]; count: number }
  >();
  for (const category of ISSUE_CLASS_ORDER)
    for (const target of targets.filter(
      (target) => target.category === category,
    )) {
      const style = { key: category, ...ISSUE_CLASSES[category] };
      const group = groups.get(style.key) ?? {
        ...style,
        targets: [],
        count: 0,
      };
      group.targets.push(target);
      group.count++;
      groups.set(style.key, group);
    }
  return [...groups.values()];
}
