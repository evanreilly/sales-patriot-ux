# Email quote review

React + TypeScript prototype with three full-height columns: threads, a tabbed quotation workflow, and complete email conversations. The middle column keeps the extracted-fields review and vendor follow-up draft as separate tabs while the ground-truth email chain remains visible on the right. Plain CSS, system fonts, React and React DOM only.

```sh
npm install
npm run dev
npm run build
npm test
```

Vite serves http://localhost:5173 by default. Tests require Node 22.6 or newer.

## Drafting a vendor follow-up

Start in **Quote review** and open an issue to see the floating review guide beside its source. **Follow up with vendor** toggles that issue in the thread's follow-up list; **View draft** opens the separate follow-up tab. Vendor-eligible extraction issues also have a flag toggle for adding or removing them in one click without opening the guide. Added questions are grouped by part and selecting a row reopens the corresponding evidence. The full sent/received chain and attachment text remain visible on the right throughout.

The fixture adapter distinguishes vendor questions from extraction checks:

- Missing quantity pricing, alternate parts, and fields that cannot be confirmed in the reply are suggested vendor questions.
- Missing extracted values already present in the source are excluded from the vendor follow-up action.
- Arithmetic discrepancies require checking the extraction first.
- Explicit no-bids, extra stock, and additional quantity tiers remain available as optional follow-ups.

Questions added from review remain in the vendor follow-up list. Their checkboxes independently include or exclude them from the current email, so users can revisit flagged issues while shaping the draft. The draft updates with those checkbox choices until manually edited; later changes preserve those edits and offer an explicit replacement action. Each thread retains its list, draft, and selections in React state while the app is open; reloading resets them. **Send email** opens the addressed, composed message in the user's default email client for review and sending.

Suggestions and wording are deterministic rules over the seeded fixture, not LLM output. Source matching is tailored to the fixture's email formats, so these are review suggestions rather than definitive vendor fault findings. The UI does not correct or mutate extracted data.

## Code

- `src/data/state.json`: supplied fixture plus a fourth, complete vendor quote.
- `src/lib/types.ts`: quote data contracts.
- `src/lib/review.ts`: request parsing and pure validation rules.
- `src/lib/evidence.ts`: per-field targets, exact ranges, inferred locations, and explanations.
- `src/lib/issueClasses.ts`: shared issue-category colors and grouping.
- `src/lib/followUp.ts`: vendor/extraction routing, suggested questions, and grouped draft generation.
- `src/components/FollowUpPane.tsx`: added-question list, source links, editable preview, and clipboard action.
- `src/components/IssueOverview.tsx`: overall category distribution and totals.
- `src/components/IssueBar.tsx`: reusable proportional bar for the overview and thread list.
- `src/components/ReviewNavigator.tsx`: floating Next/Previous issue guide.
- `src/components/EvidenceMark.tsx`: shared clickable marker and accessible hover/focus explanation.
- `src/components/EmailPane.tsx`: full conversation with source markers and separate review annotations.
- `src/components/ExtractedPane.tsx`: all extracted fields, part-header count dots, and individual discrepancy targets.
- `src/App.tsx`: thread selection and bidirectional navigation.

Sixteen tests cover validation, source mapping, distinct spans and consistent category colors, inference fallback, the distinction between missing extraction and missing vendor pricing, and follow-up question routing and draft generation.

The fixture contains one extraction snapshot per vendor. Direction and evidence are inferred from its known formats; production should provide explicit thread membership, message direction, requested parts, and exact source spans. Attachment previews use supplied page text, not rendered PDFs. The UI does not modify quote data or send email.

On screens narrower than 980px, the desktop layout scrolls horizontally to preserve readable columns.
