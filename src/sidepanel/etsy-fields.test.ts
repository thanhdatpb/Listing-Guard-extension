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

  it('reminds the user when an imported blank cell fell back to the default, until they choose a code', () => {
    const notice = field.querySelector<HTMLElement>('.code-notice')!;
    expect(notice.hidden).toBe(true); // a new form shows no reminder
    writeCodeField(field, '', true);
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('Đã dùng mã mặc định, kiểm tra lại.');
    expect(readCodeField(field)).toBe('made_to_order');

    const select = field.querySelector('select')!;
    select.value = '1990s';
    select.dispatchEvent(new Event('change'));
    expect(notice.hidden).toBe(true);

    writeCodeField(field, '', true);
    writeCodeField(field, '2010_2019', true); // a real imported value clears it
    expect(notice.hidden).toBe(true);
    writeCodeField(field, '', false); // not imported (no TSV column): no reminder
    expect(notice.hidden).toBe(true);

    writeCodeField(field, '', true);
    const other = field.querySelector('input')!;
    other.dispatchEvent(new Event('input')); // typing a code of their own also clears it
    expect(notice.hidden).toBe(true);
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
