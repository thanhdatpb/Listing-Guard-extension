import { describe, expect, it } from 'vitest';
import { normalizeListingDraft } from './listing-mapper';

describe('normalizeListingDraft', () => {
  it('trims strings and drops blanks while preserving the seller text', () => {
    expect(normalizeListingDraft({
      title: '  Hand-thrown  Mug  ',
      description: '  Handmade   stoneware.  ',
      tags: [' mug ', ' ', 'ceramic  cup '],
      price: ' 19.99 ',
      quantity: 5,
      personalization: {
        questions: [
          { type: ' TEXT ', question_text: ' Name to engrave ', required: true, options: [' Serif ', '  '] },
          null,
        ],
      },
    })).toEqual({
      title: 'Hand-thrown  Mug',
      description: 'Handmade   stoneware.',
      tags: ['mug', 'ceramic  cup'],
      price: '19.99',
      quantity: 5,
      personalization: {
        questions: [{
          type: 'TEXT',
          question_text: 'Name to engrave',
          required: true,
          options: ['Serif'],
        }],
      },
    });
  });

  it('omits fields that are absent or blank', () => {
    expect(normalizeListingDraft({
      title: '  ',
      description: null,
      tags: [' ', '\t'],
      price: ' ',
      quantity: null,
      personalization: { questions: [] },
    })).toEqual({});
  });

  it('preserves a schema-compatible Etsy price object except for trimming strings', () => {
    expect(normalizeListingDraft({
      price: { amount: ' 1999 ', divisor: 100, currency_code: ' usd ' },
    })).toEqual({
      price: { amount: '1999', divisor: 100, currency_code: 'usd' },
    });
  });
});
