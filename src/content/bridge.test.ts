import { describe, expect, it } from 'vitest';
import { installMarketplaceBridge, type MarketplaceContentMessage, type MarketplaceContentResponse } from './bridge';
import { MockAdapter } from '../adapters/mock/mock-adapter';

function captureListener(adapter: MockAdapter | null) {
  let listener: ((message: unknown, sender: unknown, response: (value: MarketplaceContentResponse) => void) => boolean | void) | undefined;
  installMarketplaceBridge(adapter, { addListener: (next) => { listener = next; } });
  return (message: MarketplaceContentMessage): MarketplaceContentResponse => {
    let result: MarketplaceContentResponse = { ok: false, code: 'INVALID_MESSAGE' };
    listener?.(message, {}, (response) => { result = response; });
    return result;
  };
}

describe('marketplace content bridge', () => {
  it('reads and locates through the adapter contract', () => {
    document.body.innerHTML = '<main data-synthetic-marketplace="mock"><input data-mock-field="title" value=" Synthetic title "></main>';
    const send = captureListener(new MockAdapter(document));

    expect(send({ type: 'READ_LISTING' })).toMatchObject({ ok: true, listing: { title: 'Synthetic title' } });
    expect(send({ type: 'LOCATE_FINDING', field: 'title', index: 0 })).toMatchObject({ ok: true, located: true });
  });

  it('does not claim Etsy DOM support without an adapter', () => {
    const send = captureListener(null);
    expect(send({ type: 'READ_LISTING' })).toEqual({ ok: false, code: 'ADAPTER_UNAVAILABLE' });
  });
});
