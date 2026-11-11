# ADR-002: Manual listing input and spreadsheet mapping

- Status: Accepted
- Date: 2026-11-11

## Context

The Etsy DOM adapter must remain fixture-backed. Until reviewed Etsy fixtures exist, users still need to check listings
without relying on DOM selectors. The API contract also supports a simple Amazon listing format, while browser access to
an Amazon editor is outside the current MVP.

## Decisions

- Add a Side Panel action with no popup and open the Side Panel when the toolbar action is clicked.
- Keep **Trang hiện tại** as the adapter-backed Etsy path. Add **Nhập tay** for Etsy and Amazon with only the fields in
  the public `docs/input-schema.md` contract.
- Send either mode's `ListingCheckRequest` through the existing service-worker API client. Fetch ruleset limits for the
  selected marketplace. Preserve all API statuses, trademark disclaimer and readiness presentation.
- In manual mode, findings have no field navigation or automatic fill. A proposed value can be copied from the Side
  Panel using the Clipboard API.
- Parse one logical TSV record, honoring quoted tabs, doubled quotes and line breaks inside quoted cells. Store only
  each marketplace's ordered field-name mapping in `chrome.storage.local`; never store the pasted row or form values.
- Keep the existing dependency set. TSV parsing and field mapping are pure TypeScript functions with unit tests.

## Consequences

Manual checks work before Etsy selector evidence is available and support the API's simple Amazon format. Users must
review imported values before checking. The extension does not write values into a marketplace editor, save listings,
or publish them. Clipboard access is initiated only by the user clicking a copy button in the Side Panel.
