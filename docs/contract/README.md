# Listing Guard API contract snapshot

These files are read-only copies of the public contract of the Listing Guard API. They let the extension's CI detect
drift between its TypeScript types and the API without needing access to the API repository.

| Snapshot file | Source file in `thanhdatpb/Listing-Guard` | Source commit |
|---|---|---|
| `openapi.snapshot.json` | `docs/api/openapi.json` | `b6a698cfe562a47aad8596086a5aec7240e536fc` (`b6a698c`, v0.7.0) |
| `input-schema.snapshot.md` | `docs/input-schema.md` | `b6a698cfe562a47aad8596086a5aec7240e536fc` (`b6a698c`, v0.7.0) |

SHA-256 of the snapshot files with line endings normalised to LF. `src/contract/contract.test.ts` fails if a file no
longer matches, so a snapshot cannot be edited by accident:

```text
edf6cc53e7f9d26fe2819bd0936e6abc234aba5ceaa73693c9b2e54b9e4e8ab4  openapi.snapshot.json
a44c9d38f414ae476d7153947deff6e8354ce2e87cb54abf806ead4fb27b84b8  input-schema.snapshot.md
```

## Why there are two files

`openapi.snapshot.json` describes responses, limits and usage. It describes the request body of `POST /api/v1/checks`
only as a free-form JSON object, so the listing fields (`title`, `tags`, `customization`, …) are defined by
`input-schema.snapshot.md`, which the API repository itself holds equal to its normalizers with a test.

## Updating the snapshot

1. In the API repository, check out the commit to adopt and note its full hash.
2. Copy `docs/api/openapi.json` and `docs/input-schema.md` over the snapshot files without modifying them.
3. Replace the commit and the two hashes above (`sha256sum` of each file).
4. Run `npm test`. A failure of `src/contract/contract.test.ts` is the point of this process: each message names the
   type and field that changed. Update `src/shared/api-types.ts` or `src/adapters/marketplace-adapter.ts`, or, for a
   field the extension deliberately does not read, extend the `unmodelled` list of that type in the test with a reason.
5. Record the change in an ADR if it changes how the extension behaves.

Never edit a snapshot file to make a test pass.

## Known snapshot discrepancy

In `openapi.snapshot.json`, `TrademarkCheckResult.findings` points at `FindingView` (the rules finding), but the
response examples in the same file and `docs/integration-guide.md` show trademark findings (`risk`, `start`, `end`,
`mark`, `matchType`, …), which is the shape of `TrademarkFindingView`. The contract test uses `TrademarkFindingView` and
the examples, and asserts that the discrepancy is still present so that it is noticed when the API repository fixes it.
