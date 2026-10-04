# Email quote review

React + TypeScript prototype with three full-height columns: threads, vendor follow-up, and complete email conversations. Plain CSS, system fonts, React and React DOM only. The `inverse` branch explores drafting vendor follow-ups; `main` retains the extracted-fields review interface.

```sh
npm install
npm run dev
npm run build
npm test
```

Vite serves http://localhost:5173 by default. Tests require Node 22.6 or newer.

## Drafting a vendor follow-up

Select questions in the middle pane to include them in an editable email, grouped by part. Source links open the corresponding evidence in the conversation; the floating guide steps through all review targets. The full sent/received chain and attachment text remain visible.

The fixture adapter distinguishes vendor questions from extraction checks:

- Missing quantity pricing, alternate parts, and fields that cannot be confirmed in the reply are suggested vendor questions.
- Missing extracted values already present in the source stay under **Check extraction** and are excluded from generated emails.
- Arithmetic discrepancies require checking the extraction first.
- Explicit no-bids, extra stock, and additional quantity tiers are optional follow-ups, unchecked initially.

The draft updates from the checklist until manually edited. Later selection changes preserve those edits and offer an explicit replacement action. Each thread retains its draft and selection in React state while the app is open; reloading resets them. **Copy email** copies recipient, subject, and body. There is no send integration.

Suggestions and wording are deterministic rules over the seeded fixture, not LLM output. Source matching is tailored to the fixture's email formats, so these are review suggestions rather than definitive vendor fault findings. The UI does not correct or mutate extracted data.

## Code

- `src/data/state.json`: supplied fixture plus a fourth, complete vendor quote.
- `src/lib/types.ts`: quote data contracts.
- `src/lib/review.ts`: request parsing and pure validation rules.
- `src/lib/evidence.ts`: per-field targets, exact ranges, inferred locations, and explanations.
- `src/lib/issueClasses.ts`: shared issue-category colors and grouping.
- `src/lib/followUp.ts`: vendor/extraction routing, suggested questions, and grouped draft generation.
- `src/components/FollowUpPane.tsx`: question checklist, source links, editable draft, and clipboard action.
- `src/components/IssueOverview.tsx`: overall category distribution and totals.
- `src/components/IssueBar.tsx`: reusable proportional bar for the overview and thread list.
- `src/components/ReviewNavigator.tsx`: floating Next/Previous issue guide.
- `src/components/EvidenceMark.tsx`: shared clickable marker and accessible hover/focus explanation.
- `src/components/EmailPane.tsx`: full conversation with source markers and separate review annotations.
- `src/components/ExtractedPane.tsx`: all extracted fields, part-header count dots, and individual discrepancy targets.
- `src/App.tsx`: thread selection and bidirectional navigation.

Sixteen tests cover validation, source mapping, distinct spans and consistent category colors, inference fallback, and the distinction between missing extraction and missing vendor pricing. Follow-up browser checks cover checkbox selection, preserving edited drafts across threads, explicit rebuilding, clipboard output, evidence navigation, the issue-free thread, and a narrower desktop viewport.

The fixture contains one extraction snapshot per vendor. Direction and evidence are inferred from its known formats; production should provide explicit thread membership, message direction, requested parts, and exact source spans. Attachment previews use supplied page text, not rendered PDFs. The UI does not modify quote data or send email.

On screens narrower than 980px, the desktop layout scrolls horizontally to preserve readable columns.
