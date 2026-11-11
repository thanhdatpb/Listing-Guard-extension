# ADR-001: Extension architecture and dependency baseline

- Status: Accepted
- Date: 2026-11-11

## Context

Listing Guard is a thin client of the independently deployed Listing Guard API. The extension reads the Etsy listing the
user is editing, sends an explicit check through its service worker, and displays API findings without changing the
listing. It does not save or publish, provide SEO, or scrape listings in bulk. The MVP supports Etsy listing-editor pages.

The API contract is defined by `docs/integration-guide.md`, `docs/input-schema.md` and `docs/api/openapi.json` in the
read-only Listing Guard repository. Findings retain their API meaning, including `INCOMPLETE`, `UNKNOWN`, trademark
disclaimers, and the separate trademark result and readiness score.

## Decisions

- Use TypeScript with strict checking, Vite for bundling, Manifest V3 for Chrome, Vitest with jsdom for tests, and ESLint
  for static linting.
- Keep Etsy DOM selectors in one versioned adapter file, based only on checked-in Etsy HTML fixtures. Do not guess a
  selector when fixtures do not support it; stop and request a fixture that contains the missing field.
- Route all API requests through the extension service worker. Store the API key, base URL and optional Cloudflare Access
  credentials only in `chrome.storage.local`; never expose them to the page, logs, errors or rendered DOM.
- Request only the Etsy listing-editor host at install time. Request the configured API host as an optional permission
  when the user saves API settings.
- Treat listing data as user content sent to the API deployment selected by the user. Do not persist listing text in the
  extension. Do not modify, save or publish marketplace content.
- Keep API results authoritative. Render findings without changing their status or meaning; show the trademark
  disclaimer, and place any readiness score alongside the trademark result at the same visual size.

## Dependencies

All dependencies are development-only; the shipped extension bundles local code and loads no remote scripts.

| Dependency | Reason |
|---|---|
| `typescript` | Strict static typing for extension code. Its compiler API also reads interface shapes in the API contract test (ADR-003); no separate dependency is needed. |
| `vite` | Bundles the service worker, content script and options page into `dist/`. |
| `vitest` | Runs unit tests. |
| `jsdom` | Supplies a DOM for adapter and UI unit tests. |
| `@types/chrome` | Types Chrome extension APIs. |
| `@types/jsdom` | Types jsdom test utilities. |
| `@types/node` | Types Node APIs used by build and test configuration. |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | Lint JavaScript/TypeScript and define browser, Node and WebExtension globals. |

## Consequences

The service worker is the only network boundary for the API. Vite output and the manifest are validated in CI. Any
additional dependency requires an explicit reason in this ADR. API behavior remains owned by the Listing Guard contract.
