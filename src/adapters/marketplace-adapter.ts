export type ListingField = 'title' | 'description' | 'tags' | 'price' | 'quantity' | 'personalization';

export interface PriceInput {
  amount: number | string;
  divisor?: number;
  currency_code?: string;
  currency?: string;
}

export interface PersonalizationQuestion {
  type?: string;
  question_text?: string;
  instructions?: string;
  required?: boolean;
  max_chars?: number;
  options?: string[];
  max_files?: number;
}

export interface EtsyListingInput {
  title?: string;
  description?: string;
  tags?: string[];
  price?: number | string | PriceInput;
  quantity?: number;
  personalization?: { questions: PersonalizationQuestion[] };
}

export interface AmazonCustomizationTextInput {
  label?: string;
  max_chars?: number;
  allowed_char_types?: string[];
}

export interface AmazonCustomizationDropdown {
  label?: string;
  options?: string[];
}

/** Parameters of an image upload place only; the extension never uploads or reads an image. */
export interface AmazonCustomizationImageInput {
  label?: string;
}

export interface AmazonCustomizationSurface {
  name?: string;
  text_inputs?: AmazonCustomizationTextInput[];
  dropdowns?: AmazonCustomizationDropdown[];
  image_inputs?: AmazonCustomizationImageInput[];
}

export interface AmazonCustomization {
  surfaces: AmazonCustomizationSurface[];
}

export interface AmazonListingInput {
  title?: string;
  brand?: string;
  bullet_points?: string[];
  description?: string;
  search_terms?: string;
  product_type?: string;
  customization?: AmazonCustomization;
}

export type MarketplaceListingInput = EtsyListingInput | AmazonListingInput;

export interface ListingDraft {
  title?: string | null;
  description?: string | null;
  tags?: readonly (string | null | undefined)[];
  price?: number | string | PriceInput | null;
  quantity?: number | null;
  personalization?: { questions?: readonly unknown[] } | null;
}

/**
 * Marketplace-specific DOM access. Implementations own field lookup, scrolling/highlighting,
 * and fill behavior so callers never need direct marketplace selectors.
 */
export interface MarketplaceAdapter {
  detectPage(): boolean;
  readListing(): EtsyListingInput | null;
  /** Return the raw current value for a supported field without normalizing it. */
  readFieldValue(field: ListingField, index?: number): string | undefined;
  /** Resolve a field, scroll it into view, and highlight it when found. */
  locate(field: ListingField, index?: number): HTMLElement | null;
  /** Fill one field and dispatch an input event. Returns false if the field is not found. */
  fill(field: ListingField, index: number, value: string): boolean;
}
