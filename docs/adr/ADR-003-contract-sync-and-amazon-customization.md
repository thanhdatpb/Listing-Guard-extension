# ADR-003: API contract snapshot, drift test and Amazon customization input

- Status: Accepted
- Date: 2026-11-11

## Context

The extension is a thin client of an API that is released independently. Its TypeScript types were written by hand from
the API documentation, so a renamed field, a new enum value or a nullable value could go unnoticed until a check failed in
use. The API's input schema also defines an optional Amazon `customization` block (Amazon Custom products) that the
manual Amazon form could not send.

## Decisions

### Contract snapshot and drift test

- Keep a byte-identical copy of `docs/api/openapi.json` and `docs/input-schema.md` of the Listing Guard API at commit
  `b6a698c` in `docs/contract/`, with the commit and SHA-256 recorded in `docs/contract/README.md`. The input schema is
  copied too because the OpenAPI document describes the request listing only as free-form JSON; the listing fields are
  defined by the input schema, which the API repository holds equal to its normalizers with a test.
- `src/contract/contract.test.ts` compares the interfaces of `src/shared/api-types.ts` and
  `src/adapters/marketplace-adapter.ts` with the snapshot: field names, enums, scalar kinds and nullability. A response
  type must accept everything the API can send; a request type may send a subset. Every contract field the extension
  does not model is listed with `unmodelled`, so a field added by a new snapshot fails the test until someone decides.
  `LimitView.kind`, `unit` and `sourceStatus` stay open (`| string`) because the integration guide says rulesets can add
  values.
- The test reads the interfaces with the TypeScript compiler API (`src/contract/ts-type-reader.ts`), so it checks the real
  types and not a runtime copy of them. `src/contract/contract-compare.test.ts` proves the comparison reports a renamed
  field, a changed enum, lost nullability and an undecided new field.
- The snapshot has one known error: `TrademarkCheckResult.findings` points at `FindingView` although its own examples
  show trademark findings. The test uses `TrademarkFindingView` and asserts the error is still present, so the override is
  removed when the API repository fixes it.

Drift found and fixed by this test: `fix.proposedValue` can be `null` (a `REMOVE` fix), a trademark finding `risk` can be
`UNKNOWN`, `fix.action` is `REPLACE | REMOVE`, and `status` is `PENDING | COMPLETED | FAILED`.

### Etsy required fields in the manual form

The ruleset `etsy-2026-12` requires `title`, `description`, `price`, `quantity`, `who_made`, `when_made` and `category`
(`required_fields`, source Etsy `createDraftListing`). The manual Etsy form sent only `title`, `tags` and `description`, so
every manual check reported the others as missing. The form now has all of them:

- `who_made` and `when_made` are dropdowns of the Etsy Open API v3 codes, kept in one file, `src/shared/etsy-codes.ts`, with
  the source and the date they were copied (2026-11-11). The input schema only gives examples, so it cannot be the source.
  Etsy changes the `2020_20xx` range code by year, so the list can go stale: each dropdown has **Mã khác** with a text box,
  and the extension never rejects an unknown code; the API reports it. Defaults are `i_did` and `made_to_order`.
- `category` is free text sent as a string, as the input schema defines it (a name or a taxonomy_id as text, never
  converted to a number).
- `price` is a decimal number sent as text (`"19.99"`); `quantity` is a whole number of zero or more sent as a JSON number.
  Anything else is refused with a Vietnamese message and not sent.
- The five fields can be added to the Etsy TSV column order in Options. The default order (`title`, `tags`, `description`)
  is unchanged. A blank `who_made` or `when_made` cell restores the default code.
- The tests check that the request carries all seven required fields. They cannot show the API's answer: the API repository
  is the source of truth for whether a finding appears.

`taxonomy_path`, `materials` and `images` stay unmodelled.

### Amazon customization input

- `AmazonListingInput.customization` has the shape of the input schema: `surfaces[]` with `name`, `text_inputs[]`
  (`label`, `max_chars`, `allowed_char_types`), `dropdowns[]` (`label`, `options`) and `image_inputs[]` (`label`).
- The manual Amazon form has a **Tùy biến Amazon Custom** section. An image input is only a label; the extension has no
  file control and never reads or uploads an image.
- Every row the user adds is sent in the order written, even when blank, so the API can report an input without
  `max_chars`. No surface means no block, and the listing is checked and hashed as before. `max_chars` is sent as a JSON
  number; text that is not a number is refused with a Vietnamese message. Other values, such as a negative number, are
  left to the API because its documentation does not define them.
- The block cannot come from a TSV row (a cell cannot hold it), so the TSV column mapping is unchanged. Customization is
  cleared when the marketplace changes, like the other manual fields, and is never persisted.

## Dependencies

No dependency is added. The contract test uses the compiler API of `typescript`, already a development dependency, and
the Node built-ins `node:fs` and `node:crypto`.

## Consequences

Updating the snapshot is a deliberate step that fails the build until the types follow it. The snapshot is a copy, not a
live link: it is only as current as its recorded commit.
