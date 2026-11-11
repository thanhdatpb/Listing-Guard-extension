# Listing Guard Chrome Extension

A Manifest V3 Chrome extension that checks an Etsy listing you are editing or a listing you enter manually with a
Listing Guard API deployment you configure. It is a thin client: it displays API results and does not save or publish
your listing, provide SEO, or scrape listings in bulk. Etsy editor support remains adapter-backed; manual input also
supports Amazon.

## Development

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

### Capture a sanitized Etsy fixture (development build)

The fixture export button and the Chrome `downloads` permission are included only by `npm run build:dev`.
The normal `npm run build` output is the production build and does not include either.

1. Run `npm install`, then `npm run build:dev`.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the repository's `dist` folder.
4. Open your own Etsy listing editor and open Listing Guard's Side Panel.
5. Choose **Xuất fixture**. The extension removes scripts, embedded frames, inline event handlers, hidden input values,
   and redacts credentials, contact details, image URLs, and shop/listing IDs before saving the HTML file.
6. Review the downloaded file and send it for selector review.

The capture feature preserves page structure and useful `id`, `name`, `data-*`, and `aria-*` attributes where possible.
Do not send an unreviewed raw page dump; only send the exported, sanitized fixture.

Load the generated `dist/` folder as an unpacked extension from `chrome://extensions` with Developer mode enabled.
Click the Listing Guard toolbar icon to open the Side Panel. Use **Trang hiện tại** for an Etsy editor with an available
adapter, or **Nhập tay** to enter Etsy or Amazon fields. To import one Google Sheets row, copy a row, paste it in the TSV
box, then click **Dán từ Google Sheet**. Configure the field order in Options first; the extension stores only field names
and their order, never the row contents.

Example default Amazon TSV row (columns in the default order):

```text
Travel Backpack	Acme	Lightweight	A durable day pack	backpack travel	BACKPACK
```

## Privacy

When you run a check, listing content is sent to the API base URL you configured. See [PRIVACY.md](PRIVACY.md) for the
current draft and [ADR-001](docs/adr/ADR-001-architecture.md) for the architecture and security decisions.

## Project phases

- P0: project scaffold and CI.
- P1: Options page and service-worker API client.
- P2: fixture-backed Etsy listing adapter.
- P2a: manual Etsy/Amazon input and Google Sheets TSV mapping.
- P3: side panel checks and findings.
- P4: explicit, guarded suggestion fill-in.
