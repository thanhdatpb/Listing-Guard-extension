import ts from 'typescript';

/**
 * Reads the shape of TypeScript interfaces from source text, so a test can compare the extension's types with the
 * API contract without runtime duplicates of those types. Test support only: nothing in the shipped extension imports it.
 */

export type Kind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

export interface TypeShape {
  kinds: Set<Kind>;
  /** String literal members, for example `ERROR` in `'ERROR' | 'WARNING'`. */
  literals: Set<string>;
  /** True when plain `string` is a member, which makes a literal union open. */
  openString: boolean;
  /** Names of interfaces this type can be. */
  refs: Set<string>;
  /** Element shape when the type is an array. */
  element?: TypeShape;
  /** Members of an inline object type. */
  inline?: Map<string, PropertyShape>;
}

export interface PropertyShape {
  name: string;
  optional: boolean;
  shape: TypeShape;
}

export type InterfaceShape = Map<string, PropertyShape>;

function emptyShape(): TypeShape {
  return { kinds: new Set(), literals: new Set(), openString: false, refs: new Set() };
}

function mergeInto(target: TypeShape, source: TypeShape): void {
  source.kinds.forEach((kind) => target.kinds.add(kind));
  source.literals.forEach((literal) => target.literals.add(literal));
  source.refs.forEach((ref) => target.refs.add(ref));
  target.openString ||= source.openString;
  if (source.element) {
    if (target.element) mergeInto(target.element, source.element);
    else target.element = source.element;
  }
  if (source.inline) target.inline = source.inline;
}

export class TypeRegistry {
  private readonly interfaces = new Map<string, ts.InterfaceDeclaration>();
  private readonly aliases = new Map<string, ts.TypeNode>();

  addSource(fileName: string, sourceText: string): void {
    const file = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    for (const statement of file.statements) {
      if (ts.isInterfaceDeclaration(statement)) this.interfaces.set(statement.name.text, statement);
      if (ts.isTypeAliasDeclaration(statement)) this.aliases.set(statement.name.text, statement.type);
    }
  }

  hasInterface(name: string): boolean {
    return this.interfaces.has(name);
  }

  interfaceShape(name: string): InterfaceShape {
    const declaration = this.interfaces.get(name);
    if (!declaration) throw new Error(`Interface ${name} was not found in the registered sources.`);
    return this.membersOf(declaration.members);
  }

  /** The shape of a named type alias such as `type Marketplace = 'ETSY' | 'AMAZON'`. */
  aliasShape(name: string): TypeShape {
    const node = this.aliases.get(name);
    if (!node) throw new Error(`Type alias ${name} was not found in the registered sources.`);
    return this.shapeOf(node, new Set());
  }

  private membersOf(members: ts.NodeArray<ts.TypeElement>): InterfaceShape {
    const result: InterfaceShape = new Map();
    for (const member of members) {
      if (!ts.isPropertySignature(member) || !member.type) continue;
      const name = ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) ? member.name.text : undefined;
      if (name === undefined) continue;
      result.set(name, { name, optional: Boolean(member.questionToken), shape: this.shapeOf(member.type, new Set()) });
    }
    return result;
  }

  private shapeOf(node: ts.TypeNode, resolving: Set<string>): TypeShape {
    const shape = emptyShape();
    if (ts.isParenthesizedTypeNode(node)) return this.shapeOf(node.type, resolving);
    if (ts.isUnionTypeNode(node)) {
      for (const member of node.types) mergeInto(shape, this.shapeOf(member, resolving));
      return shape;
    }
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
      return this.shapeOf(node.type, resolving);
    }
    if (ts.isArrayTypeNode(node)) {
      shape.kinds.add('array');
      shape.element = this.shapeOf(node.elementType, resolving);
      return shape;
    }
    if (ts.isTypeLiteralNode(node)) {
      shape.kinds.add('object');
      shape.inline = this.membersOf(node.members);
      return shape;
    }
    if (ts.isLiteralTypeNode(node)) {
      if (node.literal.kind === ts.SyntaxKind.NullKeyword) shape.kinds.add('null');
      else if (ts.isStringLiteral(node.literal)) {
        shape.kinds.add('string');
        shape.literals.add(node.literal.text);
      } else if (ts.isNumericLiteral(node.literal)) shape.kinds.add('number');
      else if (node.literal.kind === ts.SyntaxKind.TrueKeyword || node.literal.kind === ts.SyntaxKind.FalseKeyword) {
        shape.kinds.add('boolean');
      }
      return shape;
    }
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        shape.kinds.add('string');
        shape.openString = true;
        return shape;
      case ts.SyntaxKind.NumberKeyword:
        shape.kinds.add('number');
        return shape;
      case ts.SyntaxKind.BooleanKeyword:
        shape.kinds.add('boolean');
        return shape;
      case ts.SyntaxKind.UndefinedKeyword:
        return shape;
      default:
        break;
    }

    const referenceName = ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) ? node.typeName.text
      : ts.isImportTypeNode(node) && node.qualifier && ts.isIdentifier(node.qualifier) ? node.qualifier.text
        : undefined;
    if (referenceName === undefined) throw new Error(`Unsupported type syntax: ${node.getText()}`);

    if (ts.isTypeReferenceNode(node) && (referenceName === 'Array' || referenceName === 'ReadonlyArray')) {
      shape.kinds.add('array');
      const [elementType] = node.typeArguments ?? [];
      if (elementType) shape.element = this.shapeOf(elementType, resolving);
      return shape;
    }
    if (referenceName === 'Record') {
      shape.kinds.add('object');
      return shape;
    }
    const alias = this.aliases.get(referenceName);
    if (alias) {
      if (resolving.has(referenceName)) throw new Error(`Recursive type alias ${referenceName}.`);
      return this.shapeOf(alias, new Set([...resolving, referenceName]));
    }
    if (this.interfaces.has(referenceName)) {
      shape.kinds.add('object');
      shape.refs.add(referenceName);
      return shape;
    }
    throw new Error(`Type ${referenceName} is not defined in the registered sources.`);
  }
}
