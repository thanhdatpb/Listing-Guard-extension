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

Known gap, not changed here: the extension never sends the Etsy fields `who_made`, `when_made`, `category`,
`taxonomy_path`, `materials` and `images`. The API reports `who_made` and `when_made` as missing required fields, so an
Etsy check from the extension shows those findings. The test lists these fields as unmodelled; adding them is a product
decision.

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
