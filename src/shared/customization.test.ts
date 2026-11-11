import { describe, expect, it } from 'vitest';
import { buildCustomization, type CustomizationDraft } from './customization';
import { normalizeManualListing } from './tsv-mapping';

const draft: CustomizationDraft = {
  surfaces: [{
    name: ' Front ',
    textInputs: [{ label: ' Name to print ', maxChars: ' 20 ', allowedCharTypes: 'letters, numbers\n , ' }],
    dropdowns: [{ label: 'Font', options: ' Serif \n\nScript\r\n' }],
    imageInputs: [{ label: ' Photo ' }],
  }],
};

describe('Amazon customization block', () => {
  it('builds the shape of the input schema example and drops nothing the user wrote', () => {
    expect(buildCustomization(draft)).toEqual({
      surfaces: [{
        name: 'Front',
        text_inputs: [{ label: 'Name to print', max_chars: 20, allowed_char_types: ['letters', 'numbers'] }],
        dropdowns: [{ label: 'Font', options: ['Serif', 'Script'] }],
        image_inputs: [{ label: 'Photo' }],
      }],
    });
  });

  it('is absent when no surface was added, so the listing is checked exactly as before', () => {
    expect(buildCustomization({ surfaces: [] })).toBeUndefined();
    expect(normalizeManualListing('AMAZON', { title: 'Bag' }, buildCustomization({ surfaces: [] }))).toEqual({ title: 'Bag' });
  });

  it('keeps empty rows, order and duplicates so the API can report them', () => {
    const result = buildCustomization({
      surfaces: [
        {
          name: '',
          textInputs: [{ label: '', maxChars: '', allowedCharTypes: '' }, { label: 'A', maxChars: '', allowedCharTypes: '' }],
          dropdowns: [{ label: 'D', options: 'x\nx' }],
          imageInputs: [],
        },
        { name: 'Back', textInputs: [], dropdowns: [], imageInputs: [{ label: '' }] },
      ],
    });
    expect(result).toEqual({
      surfaces: [
        { text_inputs: [{}, { label: 'A' }], dropdowns: [{ label: 'D', options: ['x', 'x'] }] },
        { name: 'Back', image_inputs: [{}] },
      ],
    });
  });

  it('sends max_chars as a JSON number, leaves it out when blank, and rejects text in Vietnamese', () => {
    const withMax = (maxChars: string) => buildCustomization({
      surfaces: [{ name: '', textInputs: [{ label: '', maxChars, allowedCharTypes: '' }], dropdowns: [], imageInputs: [] }],
    });
    expect(withMax('0')?.surfaces[0].text_inputs?.[0].max_chars).toBe(0);
    expect(withMax('12.5')?.surfaces[0].text_inputs?.[0].max_chars).toBe(12.5);
    expect(withMax('  ')?.surfaces[0].text_inputs?.[0]).toEqual({});
    expect(() => withMax('hai mươi')).toThrow('Bề mặt 1, ô văn bản 1: max_chars phải là một số.');
    expect(() => withMax('1e3')).toThrow('max_chars phải là một số');
  });

  it('adds the block to an Amazon listing only, and keeps it out of Etsy and of TSV columns', () => {
    const customization = buildCustomization(draft);
    expect(normalizeManualListing('AMAZON', { title: 'Bag' }, customization)).toEqual({ title: 'Bag', customization });
    expect(normalizeManualListing('ETSY', { title: 'Mug' }, customization)).toEqual({ title: 'Mug' });
  });
});
