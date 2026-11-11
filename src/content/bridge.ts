import type { ListingField, MarketplaceAdapter } from '../adapters/marketplace-adapter';

export type MarketplaceContentMessage =
  | { type: 'READ_LISTING' }
  | { type: 'EXPORT_FIXTURE_DOM' }
  | { type: 'LOCATE_FINDING'; field: ListingField; index: number };

export type MarketplaceContentResponse =
  | { ok: true; listing?: ReturnType<MarketplaceAdapter['readListing']>; located?: boolean; html?: string }
  | { ok: false; code: 'ADAPTER_UNAVAILABLE' | 'LISTING_NOT_FOUND' | 'INVALID_MESSAGE' };

export interface RuntimeMessageSource {
  addListener(listener: (
    message: unknown,
    sender: unknown,
    sendResponse: (response: MarketplaceContentResponse) => void,
  ) => boolean | void): void;
}

function isMessage(value: unknown): value is MarketplaceContentMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const message = value as { type: unknown; field?: unknown; index?: unknown };
  if (message.type === 'READ_LISTING') return true;
  if (message.type === 'EXPORT_FIXTURE_DOM') return true;
  const validField = ['title', 'description', 'tags', 'price', 'quantity', 'personalization'].includes(String(message.field));
  return message.type === 'LOCATE_FINDING'
    && validField
    && typeof message.index === 'number'
    && Number.isInteger(message.index)
    && message.index >= 0;
}

export function installMarketplaceBridge(
  adapter: MarketplaceAdapter | null,
  runtime: RuntimeMessageSource,
  fixtureCapture: { enabled: boolean; documentRef?: Document } = { enabled: false },
): void {
  runtime.addListener((message, _sender, sendResponse) => {
    if (!isMessage(message)) {
      return false;
    }
    if (message.type === 'EXPORT_FIXTURE_DOM') {
      const documentRef = fixtureCapture.documentRef ?? (typeof document === 'undefined' ? undefined : document);
      if (!fixtureCapture.enabled || !documentRef?.documentElement) {
        sendResponse({ ok: false, code: 'INVALID_MESSAGE' });
      } else {
        sendResponse({ ok: true, html: '<!doctype html>\n' + documentRef.documentElement.outerHTML });
      }
      return false;
    }
    if (!adapter) {
      sendResponse({ ok: false, code: 'ADAPTER_UNAVAILABLE' });
      return false;
    }
    if (message.type === 'READ_LISTING') {
      if (!adapter.detectPage()) {
        sendResponse({ ok: false, code: 'LISTING_NOT_FOUND' });
        return false;
      }
      const listing = adapter.readListing();
      sendResponse(listing ? { ok: true, listing } : { ok: false, code: 'LISTING_NOT_FOUND' });
      return false;
    }
    const located = adapter.locate(message.field, message.index) !== null;
    sendResponse({ ok: true, located });
    return false;
  });
}
