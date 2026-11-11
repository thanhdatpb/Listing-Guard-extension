import type { AmazonCustomization } from '../adapters/marketplace-adapter';
import {
  buildCustomization,
  type CustomizationDraft,
  type DropdownDraft,
  type ImageInputDraft,
  type SurfaceDraft,
  type TextInputDraft,
} from '../shared/customization';

export interface CustomizationForm {
  /** Builds the `customization` block from what is typed now, or undefined when no surface was added. */
  read(): AmazonCustomization | undefined;
  /** Removes every surface. The form keeps nothing outside the DOM and never writes to storage. */
  reset(): void;
}

function control<T extends HTMLInputElement | HTMLTextAreaElement>(element: T, key: string, placeholder = ''): T {
  element.dataset.key = key;
  if (placeholder) element.placeholder = placeholder;
  return element;
}

function labelled(text: string, field: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(text, field);
  return label;
}

function button(text: string, action: string, secondary = true): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.dataset.action = action;
  if (secondary) element.className = 'secondary';
  return element;
}

function input(key: string, placeholder?: string): HTMLInputElement {
  return control(document.createElement('input'), key, placeholder);
}

function row(kind: string, ...children: HTMLElement[]): HTMLElement {
  const element = document.createElement('div');
  element.className = 'customization-row';
  element.dataset.kind = kind;
  element.append(...children, button('Xóa', 'remove-row'));
  return element;
}

function textInputRow(): HTMLElement {
  const maxChars = input('maxChars');
  maxChars.inputMode = 'numeric';
  return row(
    'text-input',
    labelled('Nhãn ô văn bản', input('label')),
    labelled('max_chars (số ký tự tối đa)', maxChars),
    labelled('Loại ký tự cho phép (phân tách bằng dấu phẩy)', input('allowedCharTypes', 'letters, numbers')),
  );
}

function dropdownRow(): HTMLElement {
  return row(
    'dropdown',
    labelled('Nhãn dropdown', input('label')),
    labelled('Các lựa chọn (mỗi dòng một lựa chọn)', control(document.createElement('textarea'), 'options')),
  );
}

function imageInputRow(): HTMLElement {
  return row('image-input', labelled('Nhãn ô ảnh (chỉ khai báo, không tải ảnh lên)', input('label')));
}

function surfaceElement(): HTMLElement {
  const surface = document.createElement('fieldset');
  surface.className = 'customization-surface';
  const legend = document.createElement('legend');
  legend.dataset.role = 'legend';
  const rows = document.createElement('div');
  rows.className = 'customization-rows';
  surface.append(
    legend,
    labelled('Tên bề mặt (ví dụ Front)', input('name')),
    rows,
    button('Thêm ô văn bản', 'add-text-input'),
    button('Thêm dropdown', 'add-dropdown'),
    button('Thêm ô ảnh', 'add-image-input'),
    button('Xóa bề mặt', 'remove-surface'),
  );
  return surface;
}

function valueOf(parent: Element, key: string): string {
  const field = parent.querySelector<HTMLInputElement | HTMLTextAreaElement>(`:scope > label > [data-key="${key}"]`);
  return field?.value ?? '';
}

export function createCustomizationForm(root: HTMLElement): CustomizationForm {
  const surfaces = document.createElement('div');
  surfaces.className = 'customization-surfaces';
  root.replaceChildren(surfaces, button('Thêm bề mặt in', 'add-surface'));

  const renumber = (): void => {
    surfaces.querySelectorAll('[data-role="legend"]').forEach((legend, index) => {
      legend.textContent = `Bề mặt ${index + 1}`;
    });
  };

  root.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    const target = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (!target) return;
    const surface = target.closest('.customization-surface');
    const rows = surface?.querySelector('.customization-rows');
    switch (target.dataset.action) {
      case 'add-surface':
        surfaces.append(surfaceElement());
        renumber();
        break;
      case 'remove-surface':
        surface?.remove();
        renumber();
        break;
      case 'add-text-input':
        rows?.append(textInputRow());
        break;
      case 'add-dropdown':
        rows?.append(dropdownRow());
        break;
      case 'add-image-input':
        rows?.append(imageInputRow());
        break;
      case 'remove-row':
        target.closest('.customization-row')?.remove();
        break;
      default:
        break;
    }
  });

  return {
    read() {
      const draft: CustomizationDraft = {
        surfaces: [...surfaces.querySelectorAll('.customization-surface')].map((surface): SurfaceDraft => {
          const rowsOf = (kind: string) => [...surface.querySelectorAll(`.customization-row[data-kind="${kind}"]`)];
          return {
            name: valueOf(surface, 'name'),
            textInputs: rowsOf('text-input').map((element): TextInputDraft => ({
              label: valueOf(element, 'label'),
              maxChars: valueOf(element, 'maxChars'),
              allowedCharTypes: valueOf(element, 'allowedCharTypes'),
            })),
            dropdowns: rowsOf('dropdown').map((element): DropdownDraft => ({
              label: valueOf(element, 'label'),
              options: valueOf(element, 'options'),
            })),
            imageInputs: rowsOf('image-input').map((element): ImageInputDraft => ({ label: valueOf(element, 'label') })),
          };
        }),
      };
      return buildCustomization(draft);
    },
    reset() {
      surfaces.replaceChildren();
    },
  };
}
