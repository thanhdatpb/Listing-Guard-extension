import { describe, expect, it } from 'vitest';
import { buildLimitCounters, findingTarget, groupFindings, renderCheckResults } from './check-view';
import type { CheckFinding, LimitView, RulesCheckResult } from '../shared/api-types';

const finding = (severity: CheckFinding['severity'], ruleId: string): CheckFinding => ({
  ruleId, source: 'RULE', severity, field: 'title', value: null, message: ruleId, suggestion: '', fix: null,
});

describe('side panel check view', () => {
  it('groups rule findings by their API severity without rewriting the severity', () => {
    const groups = groupFindings([finding('ERROR', 'one'), finding('WARNING', 'two'), finding('INFO', 'three')]);
    expect(groups.ERROR.map((item) => item.ruleId)).toEqual(['one']);
    expect(groups.WARNING.map((item) => item.ruleId)).toEqual(['two']);
    expect(groups.INFO.map((item) => item.ruleId)).toEqual(['three']);
  });

  it('maps API personalization field paths through the adapter contract', () => {
    expect(findingTarget('personalization.questions[2].question_text')).toEqual({ field: 'personalization', index: 2 });
    expect(findingTarget('personalization.questions')).toEqual({ field: 'personalization', index: 0 });
    expect(findingTarget('tags[1]')).toEqual({ field: 'tags', index: 1 });
    expect(findingTarget('unmapped.field')).toBeNull();
  });

  it('uses API limits and units for counters', () => {
    const limits: LimitView[] = [
      { field: 'title', kind: 'MAX_LENGTH', value: 12, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'tags', kind: 'MAX_COUNT', value: 7, unit: 'ITEMS', sourceStatus: 'SECONDARY', enabled: true },
      { field: 'tags', kind: 'MAX_LENGTH', value: 5, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'description', kind: 'MAX_LENGTH', value: 4, unit: 'WORDS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'title', kind: 'MAX_LENGTH', value: 3, unit: 'CODE_POINTS', sourceStatus: 'UNVERIFIED', enabled: false },
    ];
    expect(buildLimitCounters({ title: 'Hi 🧵', description: 'one two three', tags: ['a', 'b'] }, limits)).toEqual([
      { field: 'title', current: 4, limit: 12, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED' },
      { field: 'tags', current: 2, limit: 7, unit: 'ITEMS', sourceStatus: 'SECONDARY' },
      { field: 'tags[0]', current: 1, limit: 5, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED' },
      { field: 'tags[1]', current: 1, limit: 5, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED' },
      { field: 'description', current: 3, limit: 4, unit: 'WORDS', sourceStatus: 'VERIFIED' },
    ]);
  });

  it('counts Amazon fields using the selected API limits', () => {
    const limits: LimitView[] = [
      { field: 'title', kind: 'MAX_LENGTH', value: 80, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'bullet_points', kind: 'MAX_COUNT', value: 5, unit: 'ITEMS', sourceStatus: 'SECONDARY', enabled: true },
      { field: 'bullet_points', kind: 'MAX_LENGTH', value: 20, unit: 'CODE_POINTS', sourceStatus: 'UNVERIFIED', enabled: true },
    ];
    expect(buildLimitCounters({ title: 'Bag', bullet_points: ['Lightweight', 'Durable'] }, limits)).toEqual([
      { field: 'title', current: 3, limit: 80, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED' },
      { field: 'bullet_points', current: 2, limit: 5, unit: 'ITEMS', sourceStatus: 'SECONDARY' },
      { field: 'bullet_points[0]', current: 11, limit: 20, unit: 'CODE_POINTS', sourceStatus: 'UNVERIFIED' },
      { field: 'bullet_points[1]', current: 7, limit: 20, unit: 'CODE_POINTS', sourceStatus: 'UNVERIFIED' },
    ]);
  });

  it('keeps INCOMPLETE and UNKNOWN visible and pairs readiness with trademark status', () => {
    document.body.innerHTML = '<div id="results"></div>';
    const rules: RulesCheckResult = {
      checkId: 'rules-id', status: 'COMPLETED', marketplace: 'ETSY', cached: false, findings: [],
      readiness: { score: null, ready: false, status: 'INCOMPLETE', version: 'v1' },
    };
    renderCheckResults(document.querySelector('#results')!, rules, {
      checkId: 'mark-id', completeness: 'INCOMPLETE', riskLevel: 'UNKNOWN', disclaimer: 'Disclaimer', findings: [],
    }, 'complete', {}, []);
    expect(document.querySelector('.paired-status')?.textContent).toContain('UNKNOWN · INCOMPLETE');
    expect(document.querySelector('.paired-status')?.textContent).toContain('Sẵn sàng: INCOMPLETE');
    expect(document.querySelector('.trademark-section')?.textContent).toContain('Disclaimer');
  });

  it('renders an explicit apply button with the check-time value for verified fixes', () => {
    document.body.innerHTML = '<div id="results"></div>';
    const rules: RulesCheckResult = {
      checkId: 'rules-id', status: 'COMPLETED', marketplace: 'ETSY', cached: false,
      findings: [{
        ...finding('WARNING', 'title_fix'),
        fix: { action: 'REPLACE', description: 'Shorten title', proposedValue: 'Suggested title' },
      }],
      readiness: null,
    };
    renderCheckResults(document.querySelector('#results')!, rules, null, 'not-configured', { title: 'Original title' }, []);

    const button = document.querySelector<HTMLButtonElement>('[data-action="apply-suggestion"]');
    expect(button?.textContent).toBe('Điền gợi ý');
    expect(button?.dataset.field).toBe('title');
    expect(button?.dataset.expectedValue).toBe('Original title');
    expect(button?.dataset.proposedValue).toBe('Suggested title');
  });

  it('renders manual findings without field navigation or apply controls', () => {
    document.body.innerHTML = '<div id="results"></div>';
    const rules: RulesCheckResult = {
      checkId: 'rules-id', status: 'COMPLETED', marketplace: 'AMAZON', cached: false,
      findings: [{
        ...finding('WARNING', 'title_fix'),
        fix: { action: 'REPLACE', description: 'Change title', proposedValue: 'Suggested title' },
      }],
      readiness: null,
    };
    renderCheckResults(document.querySelector('#results')!, rules, null, 'not-configured', {
      title: 'Original title', brand: 'Acme',
    }, [], {}, true);

    expect(document.querySelector('button.finding')).toBeNull();
    expect(document.querySelector('[data-action="apply-suggestion"]')).toBeNull();
    expect(document.querySelector('[data-action="copy-suggestion"]')?.textContent).toBe('Sao chép giá trị đề xuất');
  });
});
