import type {
  CheckFinding,
  LimitView,
  RulesCheckResult,
  TrademarkCheckResult,
} from '../shared/api-types';

import type { EtsyListingInput } from '../adapters/marketplace-adapter';

import type { ListingField } from '../adapters/marketplace-adapter';

export function findingTarget(fieldPath: string): { field: ListingField; index: number } | null {
  const indexed = /^(tags|personalization)\[(\d+)\]$/u.exec(fieldPath);
  if (indexed) return { field: indexed[1] as ListingField, index: Number(indexed[2]) };
  const personalization = /^personalization\.questions(?:\[(\d+)\])?(?:\.(?:question_text|instructions|options(?:\[\d+\])?|max_chars|required|max_files|type))?$/u.exec(fieldPath);
  if (personalization) return { field: 'personalization', index: Number(personalization[1] ?? 0) };
  if (['title', 'description', 'price', 'quantity'].includes(fieldPath)) {
    return { field: fieldPath as ListingField, index: 0 };
  }
  return null;
}

function snapshotValue(
  listing: EtsyListingInput,
  field: ListingField,
  index: number,
): string {
  if (field === 'title' || field === 'description') return listing[field] ?? '';
  if (field === 'tags') return listing.tags?.[index] ?? '';
  if (field === 'quantity') return listing.quantity === undefined ? '' : String(listing.quantity);
  if (field === 'price') {
    if (typeof listing.price === 'string' || typeof listing.price === 'number') return String(listing.price);
    if (listing.price && typeof listing.price === 'object') return String(listing.price.amount);
    return '';
  }
  return listing.personalization?.questions[index]?.question_text ?? '';
}

export type FindingGroup = 'ERROR' | 'WARNING' | 'INFO';

export function groupFindings(findings: readonly CheckFinding[]): Record<FindingGroup, CheckFinding[]> {
  return {
    ERROR: findings.filter((finding) => finding.severity === 'ERROR'),
    WARNING: findings.filter((finding) => finding.severity === 'WARNING'),
    INFO: findings.filter((finding) => finding.severity === 'INFO'),
  };
}

function countFor(value: string, unit: string): number | null {
  if (unit === 'CODE_POINTS') return [...value].length;
  if (unit === 'UTF8_BYTES') return new TextEncoder().encode(value).length;
  if (unit === 'WORDS') return value.trim() ? value.trim().split(/\s+/u).length : 0;
  return null;
}

export interface LimitCounter {
  field: string;
  current: number;
  limit: number;
  unit: string;
  sourceStatus: string;
}

export function buildLimitCounters(listing: EtsyListingInput, limits: readonly LimitView[]): LimitCounter[] {
  const counters: LimitCounter[] = [];
  for (const limit of limits) {
    if (!limit.enabled || !Number.isFinite(limit.value)) continue;
    if (limit.kind === 'MAX_LENGTH' && (limit.field === 'title' || limit.field === 'description')) {
      const value = listing[limit.field];
      if (typeof value !== 'string') continue;
      const current = countFor(value, limit.unit);
      if (current !== null) counters.push({ field: limit.field, current, limit: limit.value, unit: limit.unit, sourceStatus: limit.sourceStatus });
    } else if (limit.field === 'tags' && limit.kind === 'MAX_COUNT' && limit.unit === 'ITEMS') {
      counters.push({ field: 'tags', current: listing.tags?.length ?? 0, limit: limit.value, unit: limit.unit, sourceStatus: limit.sourceStatus });
    } else if (limit.field === 'tags' && limit.kind === 'MAX_LENGTH' && limit.unit === 'CODE_POINTS') {
      for (const [index, tag] of (listing.tags ?? []).entries()) {
        counters.push({ field: `tags[${index}]`, current: [...tag].length, limit: limit.value, unit: limit.unit, sourceStatus: limit.sourceStatus });
      }
    }
  }
  return counters;
}

export function renderCheckResults(
  root: HTMLElement,
  rules: RulesCheckResult,
  trademark: TrademarkCheckResult | null,
  trademarkState: 'complete' | 'not-configured' | 'unavailable',
  listing: EtsyListingInput,
  limits: readonly LimitView[],
  fieldSnapshots: Readonly<Record<string, string>> = {},
): void {
  root.replaceChildren();
  const groups = groupFindings(rules.findings);
  for (const severity of ['ERROR', 'WARNING', 'INFO'] as const) {
    if (groups[severity].length === 0) continue;
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = severity;
    section.append(heading);
    for (const finding of groups[severity]) {
      const row = document.createElement('div');
      row.className = 'finding-row';
      const target = findingTarget(finding.field);
      const locateButton = document.createElement('button');
      locateButton.type = 'button';
      locateButton.className = 'finding';
      locateButton.dataset.field = finding.field;
      locateButton.textContent = finding.message;
      row.append(locateButton);
      if (target && finding.fix && typeof finding.fix.proposedValue === 'string') {
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'apply-suggestion';
        applyButton.textContent = 'Điền gợi ý';
        applyButton.dataset.action = 'apply-suggestion';
        applyButton.dataset.field = target.field;
        applyButton.dataset.index = String(target.index);
        applyButton.dataset.proposedValue = finding.fix.proposedValue;
        applyButton.dataset.expectedValue = fieldSnapshots[finding.field] ?? snapshotValue(listing, target.field, target.index);
        row.append(applyButton);
      }
      section.append(row);
    }
    root.append(section);
  }

  const trademarkSection = document.createElement('section');
  trademarkSection.className = 'trademark-section';
  const trademarkHeading = document.createElement('h2');
  trademarkHeading.textContent = 'Nhãn hiệu';
  trademarkSection.append(trademarkHeading);
  const pairedStatus = document.createElement('div');
  pairedStatus.className = 'paired-status';
  const risk = document.createElement('strong');
  risk.textContent = trademarkState === 'not-configured'
    ? 'Chưa cấu hình'
    : trademarkState === 'complete'
      ? `${trademark?.riskLevel ?? 'UNKNOWN'} · ${trademark?.completeness ?? 'INCOMPLETE'}`
      : 'Không khả dụng';
  pairedStatus.append(risk);
  if (rules.readiness) {
    const readiness = document.createElement('strong');
    readiness.textContent = `Sẵn sàng: ${rules.readiness.score === null ? rules.readiness.status : `${rules.readiness.score}/100`}`;
    pairedStatus.append(readiness);
  }
  trademarkSection.append(pairedStatus);
  if (trademark?.disclaimer) {
    const disclaimer = document.createElement('p');
    disclaimer.textContent = trademark.disclaimer;
    trademarkSection.append(disclaimer);
  } else {
    const disclaimer = document.createElement('p');
    disclaimer.textContent = 'Kết quả nhãn hiệu chỉ là cảnh báo tham khảo, không phải kết luận pháp lý.';
    trademarkSection.append(disclaimer);
  }
  for (const finding of trademark?.findings ?? []) {
    const item = document.createElement('p');
    item.className = 'finding';
    item.dataset.field = finding.field;
    item.textContent = `${finding.risk}: ${finding.message}`;
    trademarkSection.append(item);
  }
  root.append(trademarkSection);

  const counterSection = document.createElement('section');
  counterSection.className = 'counters';
  const counterHeading = document.createElement('h2');
  counterHeading.textContent = 'Bộ đếm theo giới hạn API';
  counterSection.append(counterHeading);
  for (const counter of buildLimitCounters(listing, limits)) {
    const line = document.createElement('p');
    line.textContent = `${counter.field}: ${counter.current} / ${counter.limit} (${counter.unit}, ${counter.sourceStatus})`;
    counterSection.append(line);
  }
  root.append(counterSection);
}
