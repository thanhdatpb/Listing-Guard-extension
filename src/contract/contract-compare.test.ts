// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareInterface, docTableContract, openApiContract, type Expectation, type OpenApiDocument } from './contract-compare';
import { TypeRegistry } from './ts-type-reader';

const spec: OpenApiDocument = {
  components: {
    schemas: {
      Thing: {
        required: ['name'],
        properties: {
          name: { type: 'string' },
          level: { type: 'string', enum: ['LOW', 'HIGH'] },
          count: { type: ['integer', 'null'] },
          added: { type: 'string' },
          fix: { anyOf: [{ $ref: '#/components/schemas/Fix' }, { type: 'null' }] },
        },
      },
      Fix: { properties: { proposed: { type: ['string', 'null'] } } },
    },
  },
};

function check(source: string, overrides: Partial<Expectation> = {}): string[] {
  const registry = new TypeRegistry();
  registry.addSource('thing.ts', source);
  return compareInterface(registry, {
    tsName: 'Thing',
    contract: openApiContract(spec, 'Thing'),
    direction: 'response',
    unmodelled: ['added'],
    inlineContracts: { fix: openApiContract(spec, 'Fix') },
    ...overrides,
  });
}

const matching = `interface Thing {
  name: string; level: 'LOW' | 'HIGH'; count: number | null;
  fix: { proposed: string | null } | null;
}`;

describe('contract comparison', () => {
  it('accepts types that match the contract', () => {
    expect(check(matching)).toEqual([]);
  });

  it('reports a renamed or invented field', () => {
    expect(check(matching.replace('name:', 'title:'))).toEqual(expect.arrayContaining([
      'Thing.title: the field is not in the contract.',
      'Thing: the contract field "name" is neither modelled nor listed as unmodelled.',
    ]));
  });

  it('reports an enum value that was added, removed or opened to any string', () => {
    expect(check(matching.replace("'LOW' | 'HIGH'", "'LOW'"))).toEqual([expect.stringContaining('Thing.level: enum {LOW} differs')]);
    expect(check(matching.replace("'LOW' | 'HIGH'", 'string'))).toEqual([expect.stringContaining('plain string')]);
    expect(check(matching.replace("'LOW' | 'HIGH'", "'LOW' | 'HIGH' | string"))).toEqual([expect.stringContaining('openEnums')]);
    expect(check(matching.replace("'LOW' | 'HIGH'", "'LOW' | 'HIGH' | string"), { openEnums: ['level'] })).toEqual([]);
  });

  it('reports a lost nullability, including inside an inline object', () => {
    expect(check(matching.replace('count: number | null', 'count: number')))
      .toEqual([expect.stringContaining('Thing.count: TypeScript type is {number}')]);
    expect(check(matching.replace('proposed: string | null', 'proposed: string')))
      .toEqual([expect.stringContaining('Thing.fix.proposed')]);
  });

  it('reports a contract field nobody decided about, and a stale unmodelled entry', () => {
    expect(check(matching, { unmodelled: [] }))
      .toEqual(['Thing: the contract field "added" is neither modelled nor listed as unmodelled.']);
    expect(check(matching, { unmodelled: ['added', 'gone'] }))
      .toEqual(['Thing: "gone" is listed as unmodelled but is not in the contract.']);
  });

  it('lets a request type send a subset of the contract kinds but not other kinds', () => {
    const contract = docTableContract('## Fields\n\n| Field | Type |\n|---|---|\n| `terms` | string, or array of strings |\n', 'Fields');
    const run = (source: string) => {
      const registry = new TypeRegistry();
      registry.addSource('thing.ts', source);
      return compareInterface(registry, { tsName: 'Thing', contract, direction: 'request', unmodelled: [] });
    };
    expect(run('interface Thing { terms?: string }')).toEqual([]);
    expect(run('interface Thing { terms?: number }')).toEqual([expect.stringContaining('Thing.terms')]);
  });
});
