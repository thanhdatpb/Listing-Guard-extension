import type { ListingField, MarketplaceAdapter } from '../adapters/marketplace-adapter';

export type MarketplaceContentMessage =
  | { type: 'READ_LISTING' }
  | { type: 'EXPORT_FIXTURE_DOM' }
  | { type: 'LOCATE_FINDING'; field: ListingField; index: number }
  | { type: 'FILL_SUGGESTION'; field: ListingField; index: number; value: string; expectedValue: string };

export type MarketplaceContentResponse =
  | { ok: true; listing?: ReturnType<MarketplaceAdapter['readListing']>; fieldSnapshots?: Record<string, string>; located?: boolean; filled?: boolean; html?: string }
  | { ok: false; code: 'ADAPTER_UNAVAILABLE' | 'LISTING_NOT_FOUND' | 'FIELD_CHANGED' | 'FIELD_NOT_FOUND' | 'INVALID_MESSAGE' };

export interface RuntimeMessageSource {
  addListener(listener: (
    message: unknown,
    sender: unknown,
    sendResponse: (response: MarketplaceContentResponse) => void,
  ) => boolean | void): void;
}

function isMessage(value: unknown): value is MarketplaceContentMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const message = value as { type: unknown; field?: unknown; index?: unknown; value?: unknown; expectedValue?: unknown };
  if (message.type === 'READ_LISTING') return true;
  if (message.type === 'EXPORT_FIXTURE_DOM') return true;
  const validField = ['title', 'description', 'tags', 'price', 'quantity', 'personalization'].includes(String(message.field));
  if (!validField || typeof message.index !== 'number' || !Number.isInteger(message.index) || message.index < 0) return false;
  if (message.type === 'LOCATE_FINDING') return true;
  return message.type === 'FILL_SUGGESTION'
    && typeof message.value === 'string'
    && typeof message.expectedValue === 'string';
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
    if (!adapter.detectPage()) {
      sendResponse({ ok: false, code: 'LISTING_NOT_FOUND' });
      return false;
    }
    if (message.type === 'READ_LISTING') {
      const listing = adapter.readListing();
      if (!listing) {
        sendResponse({ ok: false, code: 'LISTING_NOT_FOUND' });
        return false;
      }
      const fieldSnapshots: Record<string, string> = {};
      for (const field of ['title', 'description', 'price', 'quantity'] as const) {
        const value = adapter.readFieldValue(field, 0);
        if (value !== undefined) fieldSnapshots[field] = value;
      }
      for (let index = 0; index < (listing.tags?.length ?? 0); index += 1) {
        const value = adapter.readFieldValue('tags', index);
        if (value !== undefined) fieldSnapshots['tags[' + index + ']'] = value;
      }
      for (let index = 0; index < (listing.personalization?.questions.length ?? 0); index += 1) {
        const value = adapter.readFieldValue('personalization', index);
        if (value !== undefined) fieldSnapshots['personalization[' + index + ']'] = value;
      }
      sendResponse({ ok: true, listing, fieldSnapshots });
      return false;
    }
    if (message.type === 'LOCATE_FINDING') {
      const located = adapter.locate(message.field, message.index) !== null;
      sendResponse({ ok: true, located });
      return false;
    }

    const listing = adapter.readListing();
    if (!listing) {
      sendResponse({ ok: false, code: 'LISTING_NOT_FOUND' });
      return false;
    }
    const currentValue = adapter.readFieldValue(message.field, message.index) ?? '';
    if (currentValue !== message.expectedValue) {
      sendResponse({ ok: false, code: 'FIELD_CHANGED' });
      return false;
    }
    const filled = adapter.fill(message.field, message.index, message.value);
    sendResponse(filled ? { ok: true, filled: true } : { ok: false, code: 'FIELD_NOT_FOUND' });
    return false;
  });
}
