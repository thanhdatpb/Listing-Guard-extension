# Listing Guard Extension contributor conventions

## Scope and safety

- Build a Chrome Manifest V3 thin client of the Listing Guard API. Support the user's Etsy listing-editor page and manual Etsy/Amazon listing input in the Side Panel.
- Read the listing only to check it. Never edit, save or publish automatically; do not add SEO or bulk scraping.
- Never persist listing text. Manual TSV import may persist only field names and column order in `chrome.storage.local`.
- In manual mode, do not locate or fill marketplace fields. Copy proposed values through the Side Panel clipboard control.
- All API requests go through the extension service worker. Store the API key and base URL only in
  `chrome.storage.local`, never in sync storage, page DOM, logs or error text. Send Cloudflare Access headers only when
  the user configured them.
- Keep install-time host permission limited to the Etsy listing editor. Ask for API host access as an optional
  permission when saving the user's API configuration. Never request `tabs`, `<all_urls>`, history or cookies.
- Use no remote code, `eval`, CDN scripts or remotely loaded dependencies. Preserve Manifest V3's default CSP.
- Keep Etsy selectors in one versioned file under `src/adapters/etsy/`. Use only checked-in `fixtures/etsy/*.html` as
  selector evidence. If the fixture set is missing or does not contain the field needed, stop and ask for a fixture;
  do not guess.
- Keep the API result meaning intact. `INCOMPLETE` and `UNKNOWN` remain unchanged; always show the trademark disclaimer.
  If readiness exists, show it next to the trademark result at the same size.
- Map API errors by RFC 7807 `code` and `requestId` to Vietnamese messages. A 503 `trademark-not-configured` keeps
  rules results usable and shows trademark as “chưa cấu hình”. Never retry 429 `quota-exceeded`.
- UI text is Vietnamese; code and filenames are English.

## Engineering

- TypeScript strict, Vite, Vitest + jsdom. Keep dependencies minimal and document every dependency in
  `docs/adr/ADR-001-architecture.md`.
- Add tests for changed behavior. Before a commit, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
- Use Conventional Commits and small commits. One branch and one PR per phase; do not merge, push to main, or force-push.
- Do not publish or add secrets to CI. CI runs lint, typecheck, tests and build only.

## Commands

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```
