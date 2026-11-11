import { describe, expect, it } from 'vitest';
import { DEFAULT_TSV_COLUMN_MAPPING, mapTsvRow, normalizeManualListing, parseTsvRow } from './tsv-mapping';

// required_fields of ruleset etsy-2026-12 (Listing Guard API at b6a698c, rule-engine/.../etsy-2026-12.yaml).
const ETSY_REQUIRED_FIELDS = ['title', 'description', 'price', 'quantity', 'who_made', 'when_made', 'category'];

describe('manual Etsy required fields', () => {
  const fields = {
    title: 'Mug', description: 'A mug', category: ' Mugs ', who_made: 'i_did', when_made: 'made_to_order',
    price: ' 19.99 ', quantity: ' 5 ',
  };

  it('builds a listing that carries all seven required fields, price as text and quantity as a number', () => {
    const listing = normalizeManualListing('ETSY', fields);
    expect(Object.keys(listing)).toEqual(expect.arrayContaining(ETSY_REQUIRED_FIELDS));
    expect(listing).toMatchObject({ category: 'Mugs', price: '19.99', quantity: 5, who_made: 'i_did' });
  });

  it('refuses a price or quantity that is not a number, in Vietnamese, and keeps quantity 0', () => {
    expect(() => normalizeManualListing('ETSY', { ...fields, price: 'mười' })).toThrow('Giá phải là số thập phân');
    expect(() => normalizeManualListing('ETSY', { ...fields, quantity: '1.5' })).toThrow('Số lượng phải là số nguyên không âm.');
    expect(() => normalizeManualListing('ETSY', { ...fields, quantity: '-1' })).toThrow('Số lượng phải là số nguyên không âm.');
    expect(normalizeManualListing('ETSY', { ...fields, quantity: '0' })).toMatchObject({ quantity: 0 });
  });

  it('can map the new fields from TSV columns without changing the default column order', () => {
    expect(DEFAULT_TSV_COLUMN_MAPPING.ETSY).toEqual(['title', 'tags', 'description']);
    const mapping = {
      ...DEFAULT_TSV_COLUMN_MAPPING,
      ETSY: [...DEFAULT_TSV_COLUMN_MAPPING.ETSY, 'category', 'who_made', 'when_made', 'price', 'quantity'],
    };
    expect(mapTsvRow(['Mug', 'mug, cup', 'A mug', 'Mugs', 'collective', '2010_2019', '12.5', '3'], 'ETSY', mapping)).toEqual({
      title: 'Mug', tags: ['mug', 'cup'], description: 'A mug', category: 'Mugs', who_made: 'collective',
      when_made: '2010_2019', price: '12.5', quantity: 3,
    });
  });
});

describe('Google Sheets TSV mapping', () => {
  it('parses quoted tabs, escaped quotes, and embedded line breaks in one logical row', () => {
    expect(parseTsvRow('Title\t"first line\nsecond line"\t"a ""quote"""')).toEqual([
      'Title', 'first line\nsecond line', 'a "quote"',
    ]);
  });

  it('rejects multiple logical rows and unclosed quoted cells', () => {
    expect(() => parseTsvRow('a\tb\nnext\trow')).toThrow('Chỉ dán một hàng TSV mỗi lần.');
    expect(() => parseTsvRow('a\t"unfinished')).toThrow('dấu ngoặc kép chưa đóng');
  });

  it('maps an Amazon row to the API simple format and trims blank values', () => {
    expect(mapTsvRow([
      ' Suitcase ', ' Acme ', 'Lightweight\n\nTSA lock', ' Carry-on luggage ', 'carry on travel', ' LUGGAGE ',
    ], 'AMAZON', DEFAULT_TSV_COLUMN_MAPPING)).toEqual({
      title: 'Suitcase', brand: 'Acme', bullet_points: ['Lightweight', 'TSA lock'],
      description: 'Carry-on luggage', search_terms: 'carry on travel', product_type: 'LUGGAGE',
    });
  });
});
