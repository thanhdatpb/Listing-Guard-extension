import type { ListingField, MarketplaceAdapter } from '../adapters/marketplace-adapter';

export type MarketplaceContentMessage =
  | { type: 'READ_LISTING' }
  | { type: 'LOCATE_FINDING'; field: ListingField; index: number };

export type MarketplaceContentResponse =
  | { ok: true; listing?: ReturnType<MarketplaceAdapter['readListing']>; located?: boolean }
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
): void {
  runtime.addListener((message, _sender, sendResponse) => {
    if (!isMessage(message)) {
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
