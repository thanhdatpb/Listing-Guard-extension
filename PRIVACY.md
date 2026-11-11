# Privacy notice (draft)

Listing Guard reads listing fields from the Etsy listing-editor page, or uses listing values you enter or paste in the
Side Panel, only when you use the extension to check a listing. It sends that listing content to the Listing Guard API
at the base URL you configure, so the operator of that API receives the submitted content and handles it under that
deployment's policies. Review and trust the API deployment before use.

The API key, API base URL, and optional Cloudflare Access credentials are stored locally in Chrome using
`chrome.storage.local`; they are not stored in Chrome Sync. The extension does not intentionally send these credentials
to Etsy or place them in page content, logs, or displayed errors. API requests are made by the extension service worker.

The extension does not automatically save or publish listings, edit their fields, perform SEO, or scrape listings in
bulk. Listing text and pasted TSV rows are not stored in extension storage. The ordered field names used for TSV column
mapping may be stored locally in `chrome.storage.local`.

This draft will be completed with the shipped data flows and retention details before release.
