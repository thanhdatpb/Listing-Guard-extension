import { describe, expect, it, vi } from 'vitest';
import { installMarketplaceBridge, type MarketplaceContentMessage, type MarketplaceContentResponse } from './bridge';
import { MockAdapter } from '../adapters/mock/mock-adapter';

function captureListener(adapter: MockAdapter | null, fixtureCapture?: { enabled: boolean; documentRef?: Document }) {
  let listener: ((message: unknown, sender: unknown, response: (value: MarketplaceContentResponse) => void) => boolean | void) | undefined;
  installMarketplaceBridge(adapter, { addListener: (next) => { listener = next; } }, fixtureCapture);
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

  it('exports page markup only when the dev fixture capture build enables it', () => {
    document.body.innerHTML = '<main id="synthetic">Fixture page</main>';
    expect(captureListener(null)({ type: 'EXPORT_FIXTURE_DOM' })).toEqual({ ok: false, code: 'INVALID_MESSAGE' });
    expect(captureListener(null, { enabled: true, documentRef: document })({ type: 'EXPORT_FIXTURE_DOM' }))
      .toMatchObject({ ok: true, html: expect.stringContaining('<main id="synthetic">') });
  });

  it('refuses a suggestion after the field changes and fills only the checked value', () => {
    document.body.innerHTML = '<main data-synthetic-marketplace="mock"><input data-mock-field="title" value="Checked title"></main>';
    const title = document.querySelector<HTMLInputElement>('[data-mock-field="title"]')!;
    const inputListener = vi.fn();
    title.addEventListener('input', inputListener);
    const send = captureListener(new MockAdapter(document));

    const read = send({ type: 'READ_LISTING' });
    expect(read).toMatchObject({ ok: true, listing: { title: 'Checked title' }, fieldSnapshots: { title: 'Checked title' } });
    title.value = ' Checked title ';
    expect(send({
      type: 'FILL_SUGGESTION', field: 'title', index: 0,
      expectedValue: 'Checked title', value: 'Suggested title',
    })).toEqual({ ok: false, code: 'FIELD_CHANGED' });
    expect(title.value).toBe(' Checked title ');
    expect(inputListener).not.toHaveBeenCalled();

    expect(send({
      type: 'FILL_SUGGESTION', field: 'title', index: 0,
      expectedValue: ' Checked title ', value: 'Suggested title',
    })).toEqual({ ok: true, filled: true });
    expect(title.value).toBe('Suggested title');
    expect(inputListener).toHaveBeenCalledOnce();
  });
});
