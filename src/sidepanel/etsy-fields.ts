/**
 * A code field for the manual Etsy form: a dropdown of the known Etsy codes plus "Mã khác" with a text box. An unknown
 * code is never blocked; the API reports it.
 */
export const OTHER_CODE = '__other__';

export function createCodeField(field: string, codes: readonly string[], defaultCode: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-field';
  wrapper.dataset.manualField = field;
  wrapper.dataset.codeField = field;
  wrapper.dataset.defaultCode = defaultCode;

  const select = document.createElement('select');
  select.id = `manual-${field}`;
  for (const code of [...codes, OTHER_CODE]) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code === OTHER_CODE ? 'Mã khác…' : code;
    select.append(option);
  }
  const other = document.createElement('input');
  other.type = 'text';
  other.hidden = true;
  other.placeholder = 'Nhập mã Etsy khác';
  other.setAttribute('aria-label', `Mã ${field} khác`);
  select.addEventListener('change', () => { other.hidden = select.value !== OTHER_CODE; });
  wrapper.append(select, other);
  writeCodeField(wrapper, defaultCode);
  return wrapper;
}

export function readCodeField(wrapper: HTMLElement): string {
  const select = wrapper.querySelector('select');
  const other = wrapper.querySelector('input');
  if (!select) return '';
  return select.value === OTHER_CODE ? (other?.value.trim() ?? '') : select.value;
}

/** Sets the field to a code; an empty value restores the default code. */
export function writeCodeField(wrapper: HTMLElement, value: string): void {
  const select = wrapper.querySelector('select');
  const other = wrapper.querySelector('input');
  if (!select || !other) return;
  const code = value.trim() || wrapper.dataset.defaultCode || '';
  const known = [...select.options].some((option) => option.value === code && code !== OTHER_CODE);
  select.value = known ? code : OTHER_CODE;
  other.value = known ? '' : code;
  other.hidden = known;
}
