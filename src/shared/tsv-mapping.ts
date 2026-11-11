import type { AmazonListingInput, EtsyListingInput, MarketplaceListingInput } from '../adapters/marketplace-adapter';

export type Marketplace = 'ETSY' | 'AMAZON';

export type TsvColumnMapping = Record<Marketplace, string[]>;

export const DEFAULT_TSV_COLUMN_MAPPING: TsvColumnMapping = {
  ETSY: ['title', 'tags', 'description'],
  AMAZON: ['title', 'brand', 'bullet_points', 'description', 'search_terms', 'product_type'],
};

const validFields: Record<Marketplace, readonly string[]> = {
  ETSY: ['title', 'tags', 'description'],
  AMAZON: ['title', 'brand', 'bullet_points', 'description', 'search_terms', 'product_type'],
};

export function validateTsvColumnMapping(mapping: TsvColumnMapping): TsvColumnMapping {
  const result = {} as TsvColumnMapping;
  for (const marketplace of ['ETSY', 'AMAZON'] as const) {
    const fields = mapping[marketplace].map((field) => field.trim()).filter(Boolean);
    if (fields.length === 0 || fields.some((field) => !validFields[marketplace].includes(field))
      || new Set(fields).size !== fields.length) {
      throw new Error(`Ánh xạ cột ${marketplace} không hợp lệ.`);
    }
    result[marketplace] = fields;
  }
  return result;
}

export function parseTsvRow(input: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && input[index + 1] === '\n') index += 1;
        value += '\n';
      } else {
        value += char;
      }
      continue;
    }

    if (char === '\t') {
      values.push(value);
      value = '';
      closedQuote = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      const remainder = input.slice(index + 1).replace(/^[\t\r\n ]+|[\t\r\n ]+$/gu, '');
      if (remainder) throw new Error('Chỉ dán một hàng TSV mỗi lần.');
      break;
    } else if (char === '"' && value.length === 0 && !closedQuote) {
      quoted = true;
    } else if (closedQuote && char !== ' ' && char !== '\t') {
      throw new Error('Hàng TSV có nội dung sau dấu ngoặc kép đóng.');
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('Hàng TSV có dấu ngoặc kép chưa đóng.');
  values.push(value);
  return values;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function splitList(value: string | undefined, separator: RegExp): string[] | undefined {
  const values = value?.split(separator).map((entry) => entry.trim()).filter(Boolean);
  return values?.length ? values : undefined;
}

export function normalizeManualListing(marketplace: 'ETSY', fields: Record<string, string>): EtsyListingInput;
export function normalizeManualListing(marketplace: 'AMAZON', fields: Record<string, string>): AmazonListingInput;
export function normalizeManualListing(marketplace: Marketplace, fields: Record<string, string>): MarketplaceListingInput;
export function normalizeManualListing(marketplace: Marketplace, fields: Record<string, string>): MarketplaceListingInput {
  const title = optionalText(fields.title);
  const description = optionalText(fields.description);
  if (marketplace === 'ETSY') {
    const tags = splitList(fields.tags, /,/u);
    return {
      ...(title ? { title } : {}),
      ...(tags ? { tags } : {}),
      ...(description ? { description } : {}),
    };
  }

  const brand = optionalText(fields.brand);
  const bullet_points = splitList(fields.bullet_points, /\r?\n/u);
  const search_terms = optionalText(fields.search_terms);
  const product_type = optionalText(fields.product_type);
  return {
    ...(title ? { title } : {}),
    ...(brand ? { brand } : {}),
    ...(bullet_points ? { bullet_points } : {}),
    ...(description ? { description } : {}),
    ...(search_terms ? { search_terms } : {}),
    ...(product_type ? { product_type } : {}),
  };
}

export function mapTsvRow(
  row: readonly string[],
  marketplace: Marketplace,
  columnMapping: TsvColumnMapping,
): MarketplaceListingInput {
  const mapping = validateTsvColumnMapping(columnMapping)[marketplace];
  const fields: Record<string, string> = {};
  mapping.forEach((field, index) => {
    fields[field] = row[index] ?? '';
  });
  return normalizeManualListing(marketplace, fields);
}
