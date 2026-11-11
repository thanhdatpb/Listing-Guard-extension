// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareInterface,
  docTableContract,
  openApiContract,
  reachableInterfaces,
  type Expectation,
  type OpenApiDocument,
} from './contract-compare';
import { TypeRegistry } from './ts-type-reader';
import { DEFAULT_TSV_COLUMN_MAPPING } from '../shared/tsv-mapping';

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');

const openApiText = read('../../docs/contract/openapi.snapshot.json');
const inputSchemaText = read('../../docs/contract/input-schema.snapshot.md');
const spec = JSON.parse(openApiText) as OpenApiDocument & {
  paths: Record<string, { post?: { responses: Record<string, { content?: Record<string, { examples?: Record<string, { value: { findings?: Record<string, unknown>[] } }> }> }> } }>;
};

const registry = new TypeRegistry();
for (const file of ['../shared/api-types.ts', '../adapters/marketplace-adapter.ts', '../shared/tsv-mapping.ts']) {
  registry.addSource(file, read(file));
}

const api = (name: string, options?: Parameters<typeof openApiContract>[2]) => openApiContract(spec, name, options);
const doc = (heading: string) => docTableContract(inputSchemaText, heading);

/**
 * The snapshot points `TrademarkCheckResult.findings` at `FindingView`, which is wrong: its own examples and the
 * integration guide show `TrademarkFindingView`. See docs/contract/README.md.
 */
const trademarkItemsOverride = { findings: 'TrademarkFindingView' };

const expectations: Expectation[] = [
  { tsName: 'UsageResponse', contract: api('Usage'), direction: 'response', unmodelled: [] },
  {
    tsName: 'RulesCheckResult',
    contract: api('CheckResult'),
    direction: 'response',
    unmodelled: ['analysisVersion', 'contentHash', 'createdAt', 'fixesComputed', 'rulesetVersion', 'summary'],
    itemRefs: { CheckFinding: 'FindingView' },
    inlineContracts: { readiness: api('ReadinessView') },
  },
  {
    tsName: 'CheckFinding',
    contract: api('FindingView'),
    direction: 'response',
    unmodelled: [],
    inlineContracts: { fix: api('FixView') },
  },
  {
    tsName: 'LimitView',
    contract: api('LimitView'),
    direction: 'response',
    unmodelled: ['ruleId', 'severity'],
    // The guide says a ruleset can add rules, so kind, unit and sourceStatus may gain values the extension ignores.
    openEnums: ['kind', 'unit', 'sourceStatus'],
  },
  {
    tsName: 'RulesetLimitsResult',
    contract: api('RulesetLimitsResult'),
    direction: 'response',
    unmodelled: ['productType', 'rulesetVersion'],
    itemRefs: { LimitView: 'LimitView' },
  },
  {
    tsName: 'TrademarkCheckResult',
    contract: api('TrademarkCheckResult', { itemsRef: trademarkItemsOverride }),
    direction: 'response',
    unmodelled: [
      'analysisVersion', 'cached', 'catalogVersion', 'createdAt', 'expiresAt', 'failedRuleIds', 'marketplace', 'rulesetVersion',
    ],
    itemRefs: { TrademarkFinding: 'TrademarkFindingView' },
  },
  {
    tsName: 'TrademarkFinding',
    contract: api('TrademarkFindingView'),
    direction: 'response',
    unmodelled: [
      'end', 'insideColorPhrase', 'label', 'mark', 'matchType', 'otherRuleIds', 'ruleId', 'score', 'sourceIds', 'start',
    ],
  },
  {
    tsName: 'ListingCheckRequest',
    contract: api('CheckRequest', { enumFromDescription: ['marketplace'] }),
    direction: 'request',
    unmodelled: [],
  },
  {
    tsName: 'EtsyListingInput',
    contract: doc('Etsy (`ETSY`)'),
    direction: 'request',
    // Not read from the Etsy page or entered by hand yet. Note: without who_made and when_made the API reports them missing.
    unmodelled: ['category', 'taxonomy_path', 'materials', 'images', 'who_made', 'when_made'],
  },
  {
    tsName: 'PersonalizationQuestion',
    contract: doc('Etsy personalization questions'),
    direction: 'request',
    unmodelled: [],
  },
  {
    tsName: 'AmazonListingInput',
    contract: doc('Amazon (`AMAZON`)'),
    direction: 'request',
    unmodelled: ['price', 'quantity', 'images', 'item_highlights'],
  },
  { tsName: 'AmazonCustomization', contract: doc('Amazon customization'), direction: 'request', unmodelled: [] },
  { tsName: 'AmazonCustomizationSurface', contract: doc('Surfaces'), direction: 'request', unmodelled: [] },
  { tsName: 'AmazonCustomizationTextInput', contract: doc('Text inputs'), direction: 'request', unmodelled: [] },
  { tsName: 'AmazonCustomizationDropdown', contract: doc('Dropdowns'), direction: 'request', unmodelled: [] },
  { tsName: 'AmazonCustomizationImageInput', contract: doc('Image inputs'), direction: 'request', unmodelled: [] },
];

/** Interfaces compared by a dedicated test below because the contract has no field table for them. */
const comparedElsewhere = ['PriceInput'];

function sectionText(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^#/u.test(line) && line.replace(/^#+ /u, '') === heading);
  const end = lines.findIndex((line, index) => index > start && /^#{1,6} /u.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

const lf = (text: string): string => text.replace(/\r\n/gu, '\n');
const sha256 = (text: string): string => createHash('sha256').update(lf(text)).digest('hex');

describe('API contract snapshot', () => {
  it('is the unmodified copy recorded in docs/contract/README.md', () => {
    const readme = read('../../docs/contract/README.md');
    expect(readme).toContain('b6a698cfe562a47aad8596086a5aec7240e536fc');
    expect(readme).toContain(`${sha256(openApiText)}  openapi.snapshot.json`);
    expect(readme).toContain(`${sha256(inputSchemaText)}  input-schema.snapshot.md`);
  });

  for (const expectation of expectations) {
    it(`${expectation.tsName} matches the contract`, () => {
      expect(compareInterface(registry, expectation)).toEqual([]);
    });
  }

  it('has an expectation for every interface reachable from the API types', () => {
    const roots = ['UsageResponse', 'RulesCheckResult', 'RulesetLimitsResult', 'TrademarkCheckResult', 'ListingCheckRequest'];
    const covered = new Set([...expectations.map((item) => item.tsName), ...comparedElsewhere]);
    const missing = [...reachableInterfaces(registry, roots)].filter((name) => !covered.has(name));
    expect(missing).toEqual([]);
  });

  it('keeps PriceInput inside the price forms of the input schema', () => {
    const prices = sectionText(inputSchemaText, 'Prices');
    const fields = [...registry.interfaceShape('PriceInput').keys()];
    expect([...fields].sort()).toEqual(['amount', 'currency', 'currency_code', 'divisor']);
    for (const field of fields) expect(prices).toContain(`\`${field}\``);
  });

  it('accepts the marketplaces of the contract and only the TSV fields the input schema defines', () => {
    const marketplaces = [...registry.aliasShape('Marketplace').literals].sort();
    expect(marketplaces).toEqual(['AMAZON', 'ETSY']);
    expect(DEFAULT_TSV_COLUMN_MAPPING.ETSY.every((field) => doc('Etsy (`ETSY`)').fields.has(field))).toBe(true);
    expect(DEFAULT_TSV_COLUMN_MAPPING.AMAZON.every((field) => doc('Amazon (`AMAZON`)').fields.has(field))).toBe(true);
  });

  it('still carries the known TrademarkCheckResult.findings discrepancy, and its examples hold what the extension reads', () => {
    const schemas = spec.components.schemas as Record<string, { properties: Record<string, { items?: { $ref?: string } }> }>;
    // TODO: remove trademarkItemsOverride and this assertion once the Listing Guard API repository fixes the $ref of
    // TrademarkCheckResult.findings (it should point at TrademarkFindingView). This assertion fails when the snapshot
    // is updated to a commit that has the fix, which is the reminder to do so.
    expect(schemas.TrademarkCheckResult.properties.findings.items?.$ref).toBe('#/components/schemas/FindingView');

    const examples = spec.paths['/api/v1/trademark-checks'].post?.responses['200'].content?.['application/json'].examples ?? {};
    const findings = Object.values(examples).flatMap((example) => example.value.findings ?? []);
    expect(findings.length).toBeGreaterThan(0);
    const modelled = [...registry.interfaceShape('TrademarkFinding').keys()];
    for (const finding of findings) expect(Object.keys(finding)).toEqual(expect.arrayContaining(modelled));
  });
});
