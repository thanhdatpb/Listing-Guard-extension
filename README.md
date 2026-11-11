# Listing Guard Chrome Extension

A Manifest V3 Chrome extension that checks the Etsy listing you are editing with a Listing Guard API deployment you
configure. It is a thin client: it displays API results and does not edit, save or publish your listing, provide SEO, or
scrape listings in bulk. The MVP supports Etsy listing-editor pages; Amazon is not included.

## Development

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Load the generated `dist/` folder as an unpacked extension from `chrome://extensions` with Developer mode enabled.

## Privacy

When you run a check, listing content is sent to the API base URL you configured. See [PRIVACY.md](PRIVACY.md) for the
current draft and [ADR-001](docs/adr/ADR-001-architecture.md) for the architecture and security decisions.

## Project phases

- P0: project scaffold and CI.
- P1: Options page and service-worker API client.
- P2: fixture-backed Etsy listing adapter.
- P3: side panel checks and findings.
- P4: explicit, guarded suggestion fill-in.
