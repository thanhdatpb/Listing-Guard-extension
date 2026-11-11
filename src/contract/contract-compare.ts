import type { InterfaceShape, Kind, PropertyShape, TypeRegistry, TypeShape } from './ts-type-reader';

/** What the contract says about one field. Built from the OpenAPI snapshot or from a table of the input schema. */
export interface ContractField {
  kinds: Set<Kind>;
  enumValues?: string[];
  /** Name of the schema this field points at, when it is an object. */
  ref?: string;
  /** Name of the schema of the array items. */
  itemsRef?: string;
}

export interface ContractShape {
  fields: Map<string, ContractField>;
  required: string[];
}

type JsonObject = Record<string, unknown>;

export interface OpenApiDocument {
  components: { schemas: Record<string, JsonObject> };
}

function schemaKinds(type: unknown): Kind[] {
  const names = Array.isArray(type) ? type : type === undefined ? [] : [type];
  return names.map((name): Kind => {
    if (name === 'integer' || name === 'number') return 'number';
    if (name === 'string' || name === 'boolean' || name === 'null' || name === 'object' || name === 'array') return name;
    throw new Error(`Unsupported schema type ${String(name)}.`);
  });
}

function refName(schema: JsonObject): string | undefined {
  const ref = schema.$ref;
  return typeof ref === 'string' ? ref.slice(ref.lastIndexOf('/') + 1) : undefined;
}

function fieldOf(schema: JsonObject): ContractField {
  const field: ContractField = { kinds: new Set(schemaKinds(schema.type)) };
  const ref = refName(schema);
  if (ref) {
    field.kinds.add('object');
    field.ref = ref;
  }
  if (Array.isArray(schema.anyOf)) {
    for (const member of schema.anyOf as JsonObject[]) {
      const inner = fieldOf(member);
      inner.kinds.forEach((kind) => field.kinds.add(kind));
      field.ref ??= inner.ref;
      field.itemsRef ??= inner.itemsRef;
      field.enumValues ??= inner.enumValues;
    }
  }
  if (Array.isArray(schema.enum)) field.enumValues = schema.enum.map(String);
  if (field.kinds.has('array') && typeof schema.items === 'object' && schema.items !== null) {
    field.itemsRef = refName(schema.items as JsonObject);
  }
  return field;
}

export interface OpenApiContractOptions {
  /** Fields whose enum is only written in the description, as `Supported: A, B.`. */
  enumFromDescription?: string[];
  /** Replace the item schema of an array field the snapshot references wrongly. */
  itemsRef?: Record<string, string>;
}

export function openApiContract(
  spec: OpenApiDocument,
  schemaName: string,
  options: OpenApiContractOptions = {},
): ContractShape {
  const schema = spec.components.schemas[schemaName];
  if (!schema) throw new Error(`Schema ${schemaName} is not in the snapshot.`);
  const properties = (schema.properties ?? {}) as Record<string, JsonObject>;
  const fields = new Map<string, ContractField>();
  for (const [name, property] of Object.entries(properties)) {
    const field = fieldOf(property);
    if (options.enumFromDescription?.includes(name)) {
      const match = /Supported: ([A-Z_, ]+)\./u.exec(String(property.description));
      if (!match) throw new Error(`${schemaName}.${name} has no "Supported: …" description.`);
      field.enumValues = match[1].split(',').map((value) => value.trim());
    }
    if (options.itemsRef?.[name]) field.itemsRef = options.itemsRef[name];
    fields.set(name, field);
  }
  return { fields, required: Array.isArray(schema.required) ? (schema.required as string[]) : [] };
}

function docKinds(cell: string): Set<Kind> {
  const kinds = new Set<Kind>();
  if (/see Prices/u.test(cell)) return new Set<Kind>(['number', 'string', 'object']);
  let rest = cell;
  if (/\barray\b/u.test(rest)) {
    kinds.add('array');
    rest = rest.replace(/\barray(?: of (?:strings|objects))?/gu, '');
  }
  if (/\bstring\b/u.test(rest)) kinds.add('string');
  if (/\bnumber\b/u.test(rest)) kinds.add('number');
  if (/\bboolean\b/u.test(rest)) kinds.add('boolean');
  if (/\bobject\b/u.test(rest)) kinds.add('object');
  if (kinds.size === 0) throw new Error(`Cannot read a type from the cell "${cell}".`);
  return kinds;
}

/** Reads the field table under a heading of `input-schema.md`; the heading is matched by its text without `#`. */
export function docTableContract(markdown: string, heading: string): ContractShape {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^#{2,3} /u.test(line) && line.replace(/^#+ /u, '') === heading);
  if (start < 0) throw new Error(`Heading "${heading}" is not in the input schema snapshot.`);
  const fields = new Map<string, ContractField>();
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6} /u.test(line)) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const name = /^`([^`]+)`$/u.exec(cells[0] ?? '')?.[1];
    if (name && cells.length >= 2) fields.set(name, { kinds: docKinds(cells[1]) });
  }
  if (fields.size === 0) throw new Error(`No field table under "${heading}".`);
  return { fields, required: [] };
}

export interface Expectation {
  tsName: string;
  contract: ContractShape;
  /** A response type must accept everything the API can send; a request type may send a subset. */
  direction: 'response' | 'request';
  /** Contract fields the extension deliberately does not model. Must be exact, so new fields are noticed. */
  unmodelled: string[];
  /** Fields kept open (`'A' | 'B' | string`, or plain `string`) on purpose because the API may add values. */
  openEnums?: string[];
  /** Interface name in TypeScript to schema name in the contract, for array items. Not checked when omitted. */
  itemRefs?: Record<string, string>;
  /** Contract of the schema an inline object property points at, keyed by property name. */
  inlineContracts?: Record<string, ContractShape>;
}

function sameSet<T>(left: Set<T>, right: Set<T>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function show(values: Iterable<string>): string {
  return `{${[...values].sort().join(', ')}}`;
}

function compareProperty(
  owner: string,
  property: PropertyShape,
  field: ContractField,
  expectation: Expectation,
  problems: string[],
): void {
  const where = `${owner}.${property.name}`;
  const { shape } = property;
  const kindsMatch = expectation.direction === 'response'
    ? sameSet(shape.kinds, field.kinds)
    : [...shape.kinds].every((kind) => field.kinds.has(kind));
  if (!kindsMatch) {
    problems.push(`${where}: TypeScript type is ${show(shape.kinds)} but the contract says ${show(field.kinds)}.`);
  }
  const open = expectation.openEnums?.includes(property.name) ?? false;
  if (field.enumValues) {
    if (shape.literals.size === 0 && !open) {
      problems.push(`${where}: the contract has the enum ${show(field.enumValues)} but the type is a plain string.`);
    } else if (shape.literals.size > 0 && !sameSet(shape.literals, new Set(field.enumValues))) {
      problems.push(`${where}: enum ${show(shape.literals)} differs from the contract ${show(field.enumValues)}.`);
    }
    if (shape.openString && shape.literals.size > 0 && !open) {
      problems.push(`${where}: the enum is open (| string) but is not listed in openEnums.`);
    }
  } else if (shape.literals.size > 0) {
    problems.push(`${where}: TypeScript has the literals ${show(shape.literals)} but the contract defines no enum.`);
  }
  if (expectation.itemRefs) {
    for (const itemRef of shape.element?.refs ?? []) {
      const expected = expectation.itemRefs[itemRef];
      if (expected === undefined || expected !== field.itemsRef) {
        problems.push(`${where}: items are ${itemRef} but the contract items are ${String(field.itemsRef)}.`);
      }
    }
  }
  const inlineContract = expectation.inlineContracts?.[property.name];
  if (shape.inline && inlineContract) {
    problems.push(...compareShapes(where, shape.inline, {
      ...expectation, contract: inlineContract, unmodelled: [], inlineContracts: undefined,
    }));
  }
}

function compareShapes(owner: string, members: InterfaceShape, expectation: Expectation): string[] {
  const problems: string[] = [];
  const { contract, unmodelled } = expectation;
  for (const property of members.values()) {
    const field = contract.fields.get(property.name);
    if (!field) {
      problems.push(`${owner}.${property.name}: the field is not in the contract.`);
      continue;
    }
    compareProperty(owner, property, field, expectation, problems);
  }
  for (const name of contract.fields.keys()) {
    if (!members.has(name) && !unmodelled.includes(name)) {
      problems.push(`${owner}: the contract field "${name}" is neither modelled nor listed as unmodelled.`);
    }
  }
  for (const name of unmodelled) {
    if (!contract.fields.has(name)) problems.push(`${owner}: "${name}" is listed as unmodelled but is not in the contract.`);
    else if (members.has(name)) problems.push(`${owner}: "${name}" is listed as unmodelled but is modelled.`);
  }
  if (expectation.direction === 'request') {
    for (const name of contract.required) {
      if (!members.get(name) || members.get(name)?.optional) {
        problems.push(`${owner}.${name}: required by the contract but missing or optional.`);
      }
    }
  }
  return problems;
}

export function compareInterface(registry: TypeRegistry, expectation: Expectation): string[] {
  return compareShapes(expectation.tsName, registry.interfaceShape(expectation.tsName), expectation);
}

function collect(registry: TypeRegistry, shape: TypeShape, found: Set<string>): void {
  for (const ref of shape.refs) {
    if (found.has(ref)) continue;
    found.add(ref);
    collectInterface(registry, ref, found);
  }
  if (shape.element) collect(registry, shape.element, found);
  shape.inline?.forEach((property) => collect(registry, property.shape, found));
}

function collectInterface(registry: TypeRegistry, name: string, found: Set<string>): void {
  registry.interfaceShape(name).forEach((property) => collect(registry, property.shape, found));
}

/** Every interface reachable from the named ones, so a test can require each of them to have an expectation. */
export function reachableInterfaces(registry: TypeRegistry, roots: readonly string[]): Set<string> {
  const found = new Set(roots);
  for (const root of roots) collectInterface(registry, root, found);
  return found;
}
