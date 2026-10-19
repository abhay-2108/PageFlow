import { normalizeValue } from "./database";
import type { PropertyDef, PropertyValue } from "./database";
import type { PageMeta } from "./types";

export class FormulaError extends Error {}

type TokenType = "num" | "str" | "ident" | "op" | "lparen" | "rparen" | "comma";

interface Token {
  type: TokenType;
  value: string;
}

type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "null" }
  | { kind: "prop"; name: string }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "unary"; op: string; arg: Node }
  | { kind: "binary"; op: string; left: Node; right: Node };

const COMPARISON_OPS = ["==", "!=", "<", "<=", ">", ">="];
const MULTIPLICATIVE_OPS = ["*", "/", "%"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let value = "";
      let closed = false;
      while (j < input.length) {
        const current = input[j] as string;
        if (current === "\\" && j + 1 < input.length) {
          value += input[j + 1];
          j += 2;
          continue;
        }
        if (current === ch) {
          closed = true;
          break;
        }
        value += current;
        j += 1;
      }
      if (!closed) {
        throw new FormulaError("Unterminated string literal");
      }
      tokens.push({ type: "str", value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j] as string)) {
        j += 1;
      }
      const raw = input.slice(i, j);
      if (!Number.isFinite(Number(raw))) {
        throw new FormulaError(`Invalid number: ${raw}`);
      }
      tokens.push({ type: "num", value: raw });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j] as string)) {
        j += 1;
      }
      tokens.push({ type: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch });
      i += 1;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if (two === "&&" || two === "||") {
      tokens.push({ type: "ident", value: two === "&&" ? "and" : "or" });
      i += 2;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%" || ch === "<" || ch === ">") {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    throw new FormulaError(`Unexpected character: ${ch}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new FormulaError("Unexpected token in formula");
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private isKeyword(word: string): boolean {
    const token = this.peek();
    return token?.type === "ident" && token.value.toLowerCase() === word;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.isKeyword("or")) {
      this.next();
      left = { kind: "binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    while (this.isKeyword("and")) {
      this.next();
      left = { kind: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Node {
    if (this.isKeyword("not")) {
      this.next();
      return { kind: "unary", op: "not", arg: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Node {
    const left = this.parseAdditive();
    const token = this.peek();
    if (token?.type === "op" && COMPARISON_OPS.includes(token.value)) {
      this.next();
      return { kind: "binary", op: token.value, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    let token = this.peek();
    while (token?.type === "op" && (token.value === "+" || token.value === "-")) {
      const op = (this.next() as Token).value;
      left = { kind: "binary", op, left, right: this.parseMultiplicative() };
      token = this.peek();
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    let token = this.peek();
    while (token?.type === "op" && MULTIPLICATIVE_OPS.includes(token.value)) {
      const op = (this.next() as Token).value;
      left = { kind: "binary", op, left, right: this.parseUnary() };
      token = this.peek();
    }
    return left;
  }

  private parseUnary(): Node {
    const token = this.peek();
    if (token?.type === "op" && token.value === "-") {
      this.next();
      return { kind: "unary", op: "-", arg: this.parseUnary() };
    }
    if (token?.type === "op" && token.value === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const token = this.next();
    if (!token) {
      throw new FormulaError("Unexpected end of formula");
    }
    if (token.type === "num") {
      return { kind: "num", value: Number(token.value) };
    }
    if (token.type === "str") {
      return { kind: "str", value: token.value };
    }
    if (token.type === "lparen") {
      const node = this.parseOr();
      const closing = this.next();
      if (closing?.type !== "rparen") {
        throw new FormulaError("Expected closing parenthesis");
      }
      return node;
    }
    if (token.type === "ident") {
      const lower = token.value.toLowerCase();
      if (lower === "true") {
        return { kind: "bool", value: true };
      }
      if (lower === "false") {
        return { kind: "bool", value: false };
      }
      if (lower === "null") {
        return { kind: "null" };
      }
      if (this.peek()?.type === "lparen") {
        this.next();
        const args: Node[] = [];
        if (this.peek()?.type !== "rparen") {
          args.push(this.parseOr());
          while (this.peek()?.type === "comma") {
            this.next();
            args.push(this.parseOr());
          }
        }
        const closing = this.next();
        if (closing?.type !== "rparen") {
          throw new FormulaError("Expected closing parenthesis");
        }
        return { kind: "call", name: lower, args };
      }
      throw new FormulaError(`Unknown name: ${token.value}`);
    }
    throw new FormulaError("Unexpected token in formula");
  }
}

export function parseFormula(input: string): Node {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new FormulaError("Empty formula");
  }
  return new Parser(tokens).parse();
}

function toNumber(value: PropertyValue): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBool(value: PropertyValue): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return false;
}

function toText(value: PropertyValue): string {
  if (value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function compare(op: string, a: PropertyValue, b: PropertyValue): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return applyNumberComparison(op, a, b);
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return applyNumberComparison(op, a ? 1 : 0, b ? 1 : 0);
  }
  const left = toText(a);
  const right = toText(b);
  switch (op) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
  }
  return false;
}

function applyNumberComparison(op: string, a: number, b: number): boolean {
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
  }
  return false;
}

function resolveProperty(
  name: string,
  row: PageMeta,
  properties: PropertyDef[],
): PropertyValue {
  const lower = name.toLowerCase();
  if (lower === "name" || lower === "title") {
    return row.title;
  }
  if (lower === "created" || lower === "created time") {
    return row.createdAt;
  }
  if (lower === "updated" || lower === "last edited time") {
    return row.updatedAt;
  }
  const def = properties.find((entry) => entry.name.toLowerCase() === lower);
  if (!def) {
    return null;
  }
  if (def.type === "formula") {
    return null;
  }
  if (def.type === "created_time") {
    return row.createdAt;
  }
  if (def.type === "last_edited_time") {
    return row.updatedAt;
  }
  return normalizeValue(def.type, row.fields[def.id] ?? null);
}

function flattenNumbers(values: PropertyValue[]): number[] {
  const numbers: number[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        numbers.push(toNumber(item));
      }
    } else {
      numbers.push(toNumber(value));
    }
  }
  return numbers;
}

function evalCall(
  node: { name: string; args: Node[] },
  row: PageMeta,
  properties: PropertyDef[],
): PropertyValue {
  const args = node.args.map((arg) => evalNode(arg, row, properties));
  switch (node.name) {
    case "prop": {
      if (args.length < 1) {
        throw new FormulaError("prop() needs a property name");
      }
      return resolveProperty(toText(args[0] ?? null), row, properties);
    }
    case "if": {
      if (args.length < 2) {
        throw new FormulaError("if() needs at least two arguments");
      }
      return toBool(args[0] ?? null) ? (args[1] ?? null) : (args[2] ?? null);
    }
    case "sum":
      return flattenNumbers(args).reduce((total, value) => total + value, 0);
    case "avg": {
      const numbers = flattenNumbers(args);
      return numbers.length === 0 ? null : numbers.reduce((t, v) => t + v, 0) / numbers.length;
    }
    case "min":
      return flattenNumbers(args).reduce<number | null>(
        (best, value) => (best === null || value < best ? value : best),
        null,
      );
    case "max":
      return flattenNumbers(args).reduce<number | null>(
        (best, value) => (best === null || value > best ? value : best),
        null,
      );
    case "count":
      return flattenNumbers(args).length;
    case "len": {
      const value = args[0] ?? null;
      return Array.isArray(value) ? value.length : toText(value).length;
    }
    case "upper":
      return toText(args[0] ?? null).toUpperCase();
    case "lower":
      return toText(args[0] ?? null).toLowerCase();
    case "round": {
      const value = toNumber(args[0] ?? null);
      const digits = args.length > 1 ? Math.trunc(toNumber(args[1] ?? null)) : 0;
      const factor = 10 ** Math.max(0, Math.min(10, digits));
      return Math.round(value * factor) / factor;
    }
    case "concat":
      return args.map((value) => toText(value)).join("");
    default:
      throw new FormulaError(`Unknown function: ${node.name}`);
  }
}

function evalBinary(
  node: { op: string; left: Node; right: Node },
  row: PageMeta,
  properties: PropertyDef[],
): PropertyValue {
  if (node.op === "and") {
    const left = evalNode(node.left, row, properties);
    return toBool(left) ? evalNode(node.right, row, properties) : left;
  }
  if (node.op === "or") {
    const left = evalNode(node.left, row, properties);
    return toBool(left) ? left : evalNode(node.right, row, properties);
  }
  const left = evalNode(node.left, row, properties);
  const right = evalNode(node.right, row, properties);
  switch (node.op) {
    case "+": {
      if (typeof left === "string" || typeof right === "string") {
        return toText(left) + toText(right);
      }
      if (typeof left === "number" && typeof right === "number") {
        return left + right;
      }
      if (left === null && right === null) {
        return null;
      }
      return null;
    }
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/": {
      const divisor = toNumber(right);
      return divisor === 0 ? null : toNumber(left) / divisor;
    }
    case "%": {
      const divisor = toNumber(right);
      return divisor === 0 ? null : toNumber(left) % divisor;
    }
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return compare(node.op, left, right);
  }
  return null;
}

function evalNode(node: Node, row: PageMeta, properties: PropertyDef[]): PropertyValue {
  switch (node.kind) {
    case "num":
    case "str":
    case "bool":
      return node.value;
    case "null":
      return null;
    case "prop":
      return resolveProperty(node.name, row, properties);
    case "unary": {
      const value = evalNode(node.arg, row, properties);
      if (node.op === "not") {
        return !toBool(value);
      }
      return -toNumber(value);
    }
    case "binary":
      return evalBinary(node, row, properties);
    case "call":
      return evalCall(node, row, properties);
  }
}

export function evaluateFormula(
  expression: string,
  row: PageMeta,
  properties: PropertyDef[],
): PropertyValue {
  const ast = parseFormula(expression);
  return evalNode(ast, row, properties);
}

export function validateFormula(expression: string): string | null {
  try {
    parseFormula(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid formula";
  }
}
