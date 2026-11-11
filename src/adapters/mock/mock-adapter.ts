import { normalizeListingDraft } from '../listing-mapper';
import type {
  EtsyListingInput,
  ListingDraft,
  ListingField,
  MarketplaceAdapter,
  PersonalizationQuestion,
} from '../marketplace-adapter';

const SYNTHETIC_PAGE_SELECTOR = '[data-synthetic-marketplace="mock"]';

function getValue(element: HTMLElement | null): string | undefined {
  if (!element) return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }
  return element.textContent ?? undefined;
}

function readNumber(element: HTMLElement | null): number | undefined {
  const raw = getValue(element)?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parsePersonalization(element: HTMLElement | null): ListingDraft['personalization'] {
  if (!element) return undefined;
  try {
    const serialized = element instanceof HTMLTemplateElement
      ? element.content.textContent ?? ''
      : element.textContent ?? '';
    const value: unknown = JSON.parse(serialized);
    if (typeof value === 'object' && value !== null && 'questions' in value && Array.isArray(value.questions)) {
      return { questions: value.questions as PersonalizationQuestion[] };
    }
  } catch {
    // A malformed optional mock field is treated as absent.
  }
  return undefined;
}

/** Test-only adapter for synthetic HTML; it contains no Etsy selectors. */
export class MockAdapter implements MarketplaceAdapter {
  constructor(private readonly documentRef: Document) {}

  detectPage(): boolean {
    return this.documentRef.querySelector(SYNTHETIC_PAGE_SELECTOR) !== null;
  }

  readListing(): EtsyListingInput | null {
    if (!this.detectPage()) return null;
    const root = this.documentRef.querySelector<HTMLElement>(SYNTHETIC_PAGE_SELECTOR);
    if (!root) return null;
    const getField = (field: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-mock-field="${field}"]`);
    const tags = [...root.querySelectorAll<HTMLInputElement>('[data-mock-field="tags"]')].map((input) => input.value);
    const draft: ListingDraft = {
      title: getValue(getField('title')),
      description: getValue(getField('description')),
      tags,
      price: getValue(getField('price')),
      quantity: readNumber(getField('quantity')),
      personalization: parsePersonalization(getField('personalization-data')),
    };
    return normalizeListingDraft(draft);
  }

  locate(field: ListingField, index = 0): HTMLElement | null {
    if (!this.detectPage() || !Number.isInteger(index) || index < 0) return null;
    const indexedField = field === 'tags' || field === 'personalization';
    if (!indexedField && index !== 0) return null;
    const root = this.documentRef.querySelector<HTMLElement>(SYNTHETIC_PAGE_SELECTOR);
    if (!root) return null;
    const selector = indexedField
      ? `[data-mock-field="${field}"][data-mock-index="${index}"]`
      : `[data-mock-field="${field}"]`;
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) return null;
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    element.classList.add('listing-guard-highlight');
    return element;
  }

  fill(field: ListingField, index: number, value: string): boolean {
    const element = this.locate(field, index);
    if (!element) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = value;
    } else {
      element.textContent = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
}
