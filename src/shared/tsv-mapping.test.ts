import { describe, expect, it } from 'vitest';
import { DEFAULT_TSV_COLUMN_MAPPING, mapTsvRow, parseTsvRow } from './tsv-mapping';

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
