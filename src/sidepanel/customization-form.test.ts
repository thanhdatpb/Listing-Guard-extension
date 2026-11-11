import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomizationForm } from './customization-form';

function click(root: HTMLElement, action: string, index = 0): void {
  root.querySelectorAll<HTMLButtonElement>(`button[data-action="${action}"]`)[index].click();
}

function fill(root: HTMLElement, selector: string, value: string, index = 0): void {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)[index].value = value;
}

describe('Amazon customization form', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    root = document.querySelector<HTMLElement>('#root')!;
  });

  it('has no customization until a surface is added', () => {
    expect(createCustomizationForm(root).read()).toBeUndefined();
  });

  it('collects surfaces, text inputs, dropdowns and image inputs as the input schema defines them', () => {
    const form = createCustomizationForm(root);
    click(root, 'add-surface');
    click(root, 'add-text-input');
    click(root, 'add-dropdown');
    click(root, 'add-image-input');
    fill(root, '[data-key="name"]', 'Front');
    fill(root, '.customization-row[data-kind="text-input"] [data-key="label"]', 'Name to print');
    fill(root, '[data-key="maxChars"]', '20');
    fill(root, '[data-key="allowedCharTypes"]', 'letters');
    fill(root, '.customization-row[data-kind="dropdown"] [data-key="label"]', 'Font');
    fill(root, '[data-key="options"]', 'Serif\nScript');
    fill(root, '.customization-row[data-kind="image-input"] [data-key="label"]', 'Photo');

    expect(form.read()).toEqual({
      surfaces: [{
        name: 'Front',
        text_inputs: [{ label: 'Name to print', max_chars: 20, allowed_char_types: ['letters'] }],
        dropdowns: [{ label: 'Font', options: ['Serif', 'Script'] }],
        image_inputs: [{ label: 'Photo' }],
      }],
    });
  });

  it('offers only a label for an image input, with no file control', () => {
    createCustomizationForm(root);
    click(root, 'add-surface');
    click(root, 'add-image-input');
    const imageRow = root.querySelector('.customization-row[data-kind="image-input"]')!;
    expect(imageRow.querySelectorAll('input')).toHaveLength(1);
    expect(imageRow.querySelector('input[type="file"]')).toBeNull();
  });

  it('removes rows and surfaces, renumbers the surfaces, and resets without keeping anything', () => {
    const form = createCustomizationForm(root);
    click(root, 'add-surface');
    click(root, 'add-surface');
    click(root, 'add-text-input', 1);
    click(root, 'remove-surface', 0);
    expect(root.querySelector('[data-role="legend"]')?.textContent).toBe('Bề mặt 1');
    expect(form.read()).toEqual({ surfaces: [{ text_inputs: [{}] }] });
    click(root, 'remove-row');
    expect(form.read()).toEqual({ surfaces: [{}] });
    form.reset();
    expect(form.read()).toBeUndefined();
  });

  it('reports an invalid max_chars instead of sending it, and never touches storage', () => {
    const storage = { set: vi.fn(), get: vi.fn() };
    vi.stubGlobal('chrome', { storage: { local: storage, sync: storage } });
    const form = createCustomizationForm(root);
    click(root, 'add-surface');
    click(root, 'add-text-input');
    fill(root, '[data-key="maxChars"]', 'abc');
    expect(() => form.read()).toThrow('max_chars phải là một số');
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
