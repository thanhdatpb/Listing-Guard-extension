import { describe, expect, it } from 'vitest';
import { buildLimitCounters, groupFindings, renderCheckResults } from './check-view';
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

  it('uses API limits and units for counters', () => {
    const limits: LimitView[] = [
      { field: 'title', kind: 'MAX_LENGTH', value: 12, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'tags', kind: 'MAX_COUNT', value: 7, unit: 'ITEMS', sourceStatus: 'SECONDARY', enabled: true },
      { field: 'description', kind: 'MAX_LENGTH', value: 4, unit: 'WORDS', sourceStatus: 'VERIFIED', enabled: true },
      { field: 'title', kind: 'MAX_LENGTH', value: 3, unit: 'CODE_POINTS', sourceStatus: 'UNVERIFIED', enabled: false },
    ];
    expect(buildLimitCounters({ title: 'Hi 🧵', description: 'one two three', tags: ['a', 'b'] }, limits)).toEqual([
      { field: 'title', current: 4, limit: 12, unit: 'CODE_POINTS', sourceStatus: 'VERIFIED' },
      { field: 'tags', current: 2, limit: 7, unit: 'ITEMS', sourceStatus: 'SECONDARY' },
      { field: 'description', current: 3, limit: 4, unit: 'WORDS', sourceStatus: 'VERIFIED' },
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
});
