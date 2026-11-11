import type {
  EtsyListingInput,
  ListingDraft,
  PersonalizationQuestion,
  PriceInput,
} from './marketplace-adapter';

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function trimList(values: readonly (string | null | undefined)[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }
  const trimmed = values.map((value) => value?.trim() ?? '').filter(Boolean);
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeQuestion(value: unknown): PersonalizationQuestion | null {
  if (!isRecord(value)) {
    return null;
  }

  const question: PersonalizationQuestion = {};
  const type = trimOptional(typeof value.type === 'string' ? value.type : undefined);
  const questionText = trimOptional(typeof value.question_text === 'string' ? value.question_text : undefined);
  const instructions = trimOptional(typeof value.instructions === 'string' ? value.instructions : undefined);
  if (type !== undefined) question.type = type;
  if (questionText !== undefined) question.question_text = questionText;
  if (instructions !== undefined) question.instructions = instructions;
  if (typeof value.required === 'boolean') question.required = value.required;
  if (typeof value.max_chars === 'number') question.max_chars = value.max_chars;
  if (typeof value.max_files === 'number') question.max_files = value.max_files;
  if (Array.isArray(value.options)) {
    question.options = trimList(value.options.filter((option): option is string => typeof option === 'string')) ?? [];
  }
  return question;
}

function normalizePersonalization(
  value: ListingDraft['personalization'],
): EtsyListingInput['personalization'] {
  if (!value || !Array.isArray(value.questions)) {
    return undefined;
  }
  const questions = value.questions
    .map(normalizeQuestion)
    .filter((question): question is PersonalizationQuestion => question !== null);
  return questions.length > 0 ? { questions } : undefined;
}

function normalizePrice(value: ListingDraft['price']): EtsyListingInput['price'] {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    return trimOptional(value);
  }
  if (!value || !trimOptional(String(value.amount))) {
    return undefined;
  }

  const normalized: PriceInput = { ...value };
  if (typeof value.amount === 'string') normalized.amount = value.amount.trim();
  if (typeof value.currency_code === 'string') {
    const currencyCode = trimOptional(value.currency_code);
    if (currencyCode) normalized.currency_code = currencyCode;
    else delete normalized.currency_code;
  }
  if (typeof value.currency === 'string') {
    const currency = trimOptional(value.currency);
    if (currency) normalized.currency = currency;
    else delete normalized.currency;
  }
  return normalized;
}

/** Trim string values and drop blank fields/list entries without correcting their contents. */
export function normalizeListingDraft(draft: ListingDraft): EtsyListingInput {
  const title = trimOptional(draft.title);
  const description = trimOptional(draft.description);
  const tags = trimList(draft.tags);
  const price = normalizePrice(draft.price);
  const quantity = typeof draft.quantity === 'number' && Number.isFinite(draft.quantity)
    ? draft.quantity
    : undefined;
  const personalization = normalizePersonalization(draft.personalization);

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(personalization !== undefined ? { personalization } : {}),
  };
}
