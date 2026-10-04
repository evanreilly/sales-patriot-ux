# Email quote review

React + TypeScript prototype with three full-height columns: threads, Quotation review, and complete email conversations. Plain CSS, system fonts, React and React DOM only.

```sh
npm install
npm run dev
npm run build
npm test
```

Vite serves http://localhost:5173 by default. Tests require Node 22.6 or newer.

## Reviewing discrepancies

Quotation review is the wider primary working pane, with larger field text. Its summary combines a proportional category bar, and class-level totals. Colored count dots live in the header of each detailed part breakdown. Issues remain numbered in review order, and the overview links intentionally have no hover text.

Colors consistently identify issue types across threads, fields, and source text. The overview dots and proportional bars group by class: all missing fields share one blue class. Individual missing-field highlights share that blue background, with a secondary underline/outline color for unit price, total, currency, lead time, and other field types. Each thread in the left list carries a matching class-level proportional issue bar. Green is reserved for good-to-go states. Item descriptions lead the green headers, with part numbers on the right. Sender and recipient details share a compact inline row.

Clicking a flagged field, source marker, or overview link opens a small non-blocking review dialog. Next field and Previous center both panes on the corresponding issue. The dialog is anchored immediately beneath the active source marker, follows its horizontal position within the pane, and stays within the window. Finish review, Close, or Escape dismisses it. Navigation does not resolve or change quote data. Detailed field/source markers retain hover explanations; the summary has none.

- A value missing from extraction links to the exact value in the vendor text when available. Unit price, total, currency, and lead time are separate targets.
- A missing quantity break is a gap in the vendor reply. It links to an explicitly labeled review annotation near the vendor's pricing section, never a warning on the complete original request.
- Missing source values use a labeled inferred position within the quoted part. Review annotations are visually separate from original email text.
- Original requests and earlier replies remain visible and unmodified. Discrepancy markers attach to the latest vendor response, including inline attachment text.

Explanations currently derive from fixture values and validation rules. No LLM call or backend is needed. A future extraction service can supply exact spans and explanations through the same target model.

## Code

- `src/data/state.json`: unchanged supplied fixture.
- `src/lib/types.ts`: quote data contracts.
- `src/lib/review.ts`: request parsing and pure validation rules.
- `src/lib/evidence.ts`: per-field targets, exact ranges, inferred locations, and explanations.
- `src/lib/issueClasses.ts`: shared category and missing-field colors, labels, and shared grouping.
- `src/components/IssueOverview.tsx`: overall category distribution and totals.
- `src/components/IssueBar.tsx`: reusable proportional bar for the overview and thread list.
- `src/components/ReviewNavigator.tsx`: floating Next/Previous issue guide.
- `src/components/EvidenceMark.tsx`: shared clickable marker and accessible hover/focus explanation.
- `src/components/EmailPane.tsx`: full conversation with source markers and separate review annotations.
- `src/components/ExtractedPane.tsx`: all extracted fields, part-header count dots, and individual discrepancy targets.
- `src/App.tsx`: thread selection and bidirectional navigation.

Fourteen tests cover validation, source mapping, distinct spans and consistent category colors, inference fallback, and the distinction between missing extraction and missing vendor pricing. Browser checks exercise all 47 guided review steps, centered source visibility and anchored dialog placement, Previous/Next boundaries, summary hover behavior, and direct field entry.

The fixture contains one extraction snapshot per vendor. Direction and evidence are inferred from its known formats; production should provide explicit thread membership, message direction, requested parts, and exact source spans. Attachment previews use supplied page text, not rendered PDFs. The UI does not modify quote data or send email.

On screens narrower than 980px, the desktop layout scrolls horizontally to preserve readable columns.
