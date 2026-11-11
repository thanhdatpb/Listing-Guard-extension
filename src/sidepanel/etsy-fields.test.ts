import { beforeEach, describe, expect, it } from 'vitest';
import { createCodeField, readCodeField, writeCodeField } from './etsy-fields';
import { DEFAULT_WHEN_MADE, WHEN_MADE_CODES, WHO_MADE_CODES } from '../shared/etsy-codes';

describe('Etsy code fields', () => {
  let field: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    field = createCodeField('when_made', WHEN_MADE_CODES, DEFAULT_WHEN_MADE);
    document.body.append(field);
  });

  it('offers every Etsy code and Mã khác, with the default selected', () => {
    const options = [...field.querySelectorAll('option')].map((option) => option.value);
    expect(options).toHaveLength(WHEN_MADE_CODES.length + 1);
    expect(options).toContain('before_1700');
    expect(readCodeField(field)).toBe('made_to_order');
    expect(createCodeField('who_made', WHO_MADE_CODES, 'i_did').querySelectorAll('option')).toHaveLength(4);
  });

  it('sends a code typed under Mã khác instead of blocking it', () => {
    const select = field.querySelector('select')!;
    select.value = '__other__';
    select.dispatchEvent(new Event('change'));
    expect(field.querySelector('input')!.hidden).toBe(false);
    field.querySelector('input')!.value = ' 2020_2027 ';
    expect(readCodeField(field)).toBe('2020_2027');
  });

  it('writes a known code, an unknown code and an empty value (default)', () => {
    writeCodeField(field, '1990s');
    expect(readCodeField(field)).toBe('1990s');
    writeCodeField(field, '2020_2030');
    expect(field.querySelector('select')!.value).toBe('__other__');
    expect(readCodeField(field)).toBe('2020_2030');
    writeCodeField(field, '');
    expect(readCodeField(field)).toBe('made_to_order');
    expect(field.querySelector('input')!.hidden).toBe(true);
  });
});
