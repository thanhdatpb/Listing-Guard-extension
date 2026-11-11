import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from './mock-adapter';

describe('MockAdapter', () => {
  it('reads a synthetic, not Etsy DOM, page into Listing Guard input fields', () => {
    // Synthetic, not Etsy DOM. This markup is test-only and must not be used to infer Etsy selectors.
    document.body.innerHTML = `
      <main data-synthetic-marketplace="mock">
        <input data-mock-field="title" value="  Handmade mug  ">
        <textarea data-mock-field="description"> Stoneware, glazed by hand. </textarea>
        <input data-mock-field="tags" data-mock-index="0" value=" mug ">
        <input data-mock-field="tags" data-mock-index="1" value=" ">
        <input data-mock-field="tags" data-mock-index="2" value="ceramic cup ">
        <input data-mock-field="price" value=" 19.99 ">
        <input data-mock-field="quantity" type="number" value="5">
        <input data-mock-field="personalization" data-mock-index="0" value="Name to engrave">
        <template data-mock-field="personalization-data">{"questions":[{"type":"TEXT","question_text":" Name to engrave ","required":true}]}</template>
      </main>`;
    const adapter = new MockAdapter(document);

    expect(adapter.detectPage()).toBe(true);
    expect(adapter.readListing()).toEqual({
      title: 'Handmade mug',
      description: 'Stoneware, glazed by hand.',
      tags: ['mug', 'ceramic cup'],
      price: '19.99',
      quantity: 5,
      personalization: {
        questions: [{ type: 'TEXT', question_text: 'Name to engrave', required: true }],
      },
    });
  });

  it('locates and highlights a tag by index and dispatches input on fill', () => {
    document.body.innerHTML = `
      <main data-synthetic-marketplace="mock">
        <input data-mock-field="tags" data-mock-index="0" value="first">
        <input data-mock-field="tags" data-mock-index="1" value="second">
        <input data-mock-field="personalization" data-mock-index="0" value="engraving text">
      </main>`;
    const adapter = new MockAdapter(document);
    const secondTag = document.querySelector<HTMLInputElement>('[data-mock-index="1"]');
    const scrollIntoView = vi.fn();
    if (secondTag) secondTag.scrollIntoView = scrollIntoView;
    const inputListener = vi.fn();
    secondTag?.addEventListener('input', inputListener);

    expect(adapter.locate('tags', 1)).toBe(secondTag);
    expect(secondTag?.classList.contains('listing-guard-highlight')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(adapter.fill('tags', 1, 'updated tag')).toBe(true);
    expect(secondTag?.value).toBe('updated tag');
    expect(inputListener).toHaveBeenCalledOnce();

    const personalization = adapter.locate('personalization', 0) as HTMLInputElement;
    expect(adapter.fill('personalization', 0, 'updated personalization')).toBe(true);
    expect(personalization.value).toBe('updated personalization');
  });

  it('does not detect or read pages without its synthetic marker', () => {
    document.body.innerHTML = '<main><input data-mock-field="title" value="Anything"></main>';
    const adapter = new MockAdapter(document);

    expect(adapter.detectPage()).toBe(false);
    expect(adapter.readListing()).toBeNull();
    expect(adapter.locate('title')).toBeNull();
    expect(adapter.fill('title', 0, 'changed')).toBe(false);
  });
});
