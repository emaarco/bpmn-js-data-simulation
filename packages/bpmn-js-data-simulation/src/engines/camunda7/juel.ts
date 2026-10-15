import type { Variables } from '../../domain/model.js'

class JuelError extends Error {
  override name = 'JuelError'
}

type Node =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: Node; property: Node }
  | { type: 'unary'; operator: string; operand: Node }
  | { type: 'binary'; operator: string; left: Node; right: Node }
  | { type: 'conditional'; test: Node; consequent: Node; alternate: Node }

export type JuelTemplate = Array<string | Node>

interface Token {
  kind: 'number' | 'string' | 'identifier' | 'operator'
  text: string
  value?: unknown
}

const KEYWORD_OPERATORS: Record<string, string> = {
  and: '&&',
  or: '||',
  not: '!',
  eq: '==',
  ne: '!=',
  lt: '<',
  gt: '>',
  le: '<=',
  ge: '>=',
  div: '/',
  mod: '%',
  empty: 'empty',
}

const SYMBOL_OPERATORS = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<',
  '>',
  '!',
  '+',
  '-',
  '*',
  '/',
  '%',
  '(',
  ')',
  '[',
  ']',
  '.',
  '?',
  ':',
]

export function parseJuelTemplate(text: string): JuelTemplate {
  const parts: JuelTemplate = []
  let cursor = 0
  while (cursor < text.length) {
    const start = findExpressionStart(text, cursor)
    if (start === -1) {
      parts.push(text.slice(cursor))
      break
    }
    if (start > cursor) parts.push(text.slice(cursor, start))
    const end = findExpressionEnd(text, start + 2)
    parts.push(parseJuelExpression(text.slice(start + 2, end)))
    cursor = end + 1
  }
  return parts
}

export function evaluateJuelTemplate(template: JuelTemplate, variables: Variables): unknown {
  if (template.length === 1 && typeof template[0] !== 'string') {
    return evaluateNode(template[0], variables)
  }
  return template
    .map(part => (typeof part === 'string' ? part : coerceToString(evaluateNode(part, variables))))
    .join('')
}

export function readJuelVariableNames(template: JuelTemplate): string[] {
  const names = new Set<string>()
  const visit = (node: Node): void => {
    if (node.type === 'identifier') names.add(node.name)
    if (node.type === 'member') {
      visit(node.object)
      visit(node.property)
    }
    if (node.type === 'unary') visit(node.operand)
    if (node.type === 'binary') {
      visit(node.left)
      visit(node.right)
    }
    if (node.type === 'conditional') {
      visit(node.test)
      visit(node.consequent)
      visit(node.alternate)
    }
  }
  template.forEach(part => typeof part !== 'string' && visit(part))
  return [...names]
}

function findExpressionStart(text: string, from: number): number {
  const dollar = text.indexOf('${', from)
  const hash = text.indexOf('#{', from)
  if (dollar === -1) return hash
  if (hash === -1) return dollar
  return Math.min(dollar, hash)
}

function findExpressionEnd(text: string, from: number): number {
  let quote: string | null = null
  for (let index = from; index < text.length; index++) {
    const char = text[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = null
    } else if (char === "'" || char === '"') {
      quote = char
    } else if (char === '}') {
      return index
    }
  }
  throw new JuelError('Unterminated expression, missing "}"')
}

function parseJuelExpression(source: string): Node {
  const parser = new Parser(tokenize(source))
  const node = parser.parseExpression()
  parser.expectEnd()
  return node
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index++
    } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[index + 1] ?? ''))) {
      const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(source.slice(index))!
      tokens.push({ kind: 'number', text: match[0], value: Number(match[0]) })
      index += match[0].length
    } else if (char === "'" || char === '"') {
      const { value, length } = readString(source, index)
      tokens.push({ kind: 'string', text: source.slice(index, index + length), value })
      index += length
    } else if (/[A-Za-z_$]/.test(char)) {
      const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index))!
      const word = match[0]
      const keywordOperator = hasOwn(KEYWORD_OPERATORS, word) ? KEYWORD_OPERATORS[word] : undefined
      tokens.push(keywordOperator ? { kind: 'operator', text: keywordOperator } : { kind: 'identifier', text: word })
      index += word.length
    } else {
      const operator = SYMBOL_OPERATORS.find(candidate => source.startsWith(candidate, index))
      if (!operator) throw new JuelError(`Unexpected character "${char}"`)
      tokens.push({ kind: 'operator', text: operator })
      index += operator.length
    }
  }
  return tokens
}

function readString(source: string, start: number): { value: string; length: number } {
  const quote = source[start]
  let value = ''
  for (let index = start + 1; index < source.length; index++) {
    const char = source[index]
    if (char === '\\') {
      value += source[index + 1] ?? ''
      index++
    } else if (char === quote) {
      return { value, length: index - start + 1 }
    } else {
      value += char
    }
  }
  throw new JuelError('Unterminated string literal')
}

class Parser {
  private position = 0

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): Node {
    const test = this.parseBinary(0)
    if (!this.accept('?')) return test
    const consequent = this.parseExpression()
    this.expect(':')
    const alternate = this.parseExpression()
    return { type: 'conditional', test, consequent, alternate }
  }

  expectEnd(): void {
    const token = this.peek()
    if (token) throw new JuelError(`Unexpected "${token.text}"`)
  }

  private static readonly PRECEDENCE: string[][] = [
    ['||'],
    ['&&'],
    ['==', '!='],
    ['<', '>', '<=', '>='],
    ['+', '-'],
    ['*', '/', '%'],
  ]

  private parseBinary(level: number): Node {
    if (level === Parser.PRECEDENCE.length) return this.parseUnary()
    let left = this.parseBinary(level + 1)
    let operator = this.acceptAny(Parser.PRECEDENCE[level])
    while (operator) {
      const right = this.parseBinary(level + 1)
      left = { type: 'binary', operator, left, right }
      operator = this.acceptAny(Parser.PRECEDENCE[level])
    }
    return left
  }

  private parseUnary(): Node {
    const operator = this.acceptAny(['!', '-', 'empty'])
    if (operator) return { type: 'unary', operator, operand: this.parseUnary() }
    return this.parseMember()
  }

  private parseMember(): Node {
    let node = this.parsePrimary()
    for (;;) {
      if (this.accept('.')) {
        const property = this.next()
        if (property?.kind !== 'identifier') throw new JuelError('Expected a property name after "."')
        node = { type: 'member', object: node, property: { type: 'literal', value: property.text } }
      } else if (this.accept('[')) {
        node = { type: 'member', object: node, property: this.parseExpression() }
        this.expect(']')
      } else if (this.peek()?.text === '(') {
        throw new JuelError('Method calls are not supported')
      } else {
        return node
      }
    }
  }

  private parsePrimary(): Node {
    const token = this.next()
    if (!token) throw new JuelError('Unexpected end of expression')
    if (token.kind === 'number' || token.kind === 'string') return { type: 'literal', value: token.value }
    if (token.kind === 'identifier') return identifierOrLiteral(token.text)
    if (token.text === '(') {
      const node = this.parseExpression()
      this.expect(')')
      return node
    }
    throw new JuelError(`Unexpected "${token.text}"`)
  }

  private peek(): Token | undefined {
    return this.tokens[this.position]
  }

  private next(): Token | undefined {
    return this.tokens[this.position++]
  }

  private accept(text: string): boolean {
    if (this.peek()?.kind !== 'operator' || this.peek()?.text !== text) return false
    this.position++
    return true
  }

  private acceptAny(operators: string[]): string | undefined {
    return operators.find(operator => this.accept(operator))
  }

  private expect(text: string): void {
    if (!this.accept(text)) throw new JuelError(`Expected "${text}"`)
  }
}

function identifierOrLiteral(name: string): Node {
  if (name === 'true') return { type: 'literal', value: true }
  if (name === 'false') return { type: 'literal', value: false }
  if (name === 'null') return { type: 'literal', value: null }
  return { type: 'identifier', name }
}

function evaluateNode(node: Node, variables: Variables): unknown {
  switch (node.type) {
    case 'literal':
      return node.value
    case 'identifier':
      if (!hasOwn(variables, node.name)) throw new JuelError(`Unknown property used in expression: ${node.name}`)
      return variables[node.name]
    case 'member':
      return readMember(evaluateNode(node.object, variables), evaluateNode(node.property, variables))
    case 'unary':
      return evaluateUnary(node.operator, evaluateNode(node.operand, variables))
    case 'conditional':
      return coerceToBoolean(evaluateNode(node.test, variables))
        ? evaluateNode(node.consequent, variables)
        : evaluateNode(node.alternate, variables)
    case 'binary':
      return evaluateBinary(node, variables)
  }
}

function readMember(object: unknown, property: unknown): unknown {
  if (object === null || object === undefined) return null
  const key = Array.isArray(object) ? Number(property) : String(property)
  return hasOwn(object as object, key) ? ((object as Record<string | number, unknown>)[key] ?? null) : null
}

function hasOwn(object: object, key: string | number): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function evaluateUnary(operator: string, operand: unknown): unknown {
  if (operator === '!') return !coerceToBoolean(operand)
  if (operator === '-') return -coerceToNumber(operand)
  return isEmpty(operand)
}

function evaluateBinary(node: Extract<Node, { type: 'binary' }>, variables: Variables): unknown {
  const { operator } = node
  if (operator === '&&') {
    return coerceToBoolean(evaluateNode(node.left, variables)) && coerceToBoolean(evaluateNode(node.right, variables))
  }
  if (operator === '||') {
    return coerceToBoolean(evaluateNode(node.left, variables)) || coerceToBoolean(evaluateNode(node.right, variables))
  }
  const left = evaluateNode(node.left, variables)
  const right = evaluateNode(node.right, variables)
  switch (operator) {
    case '==':
      return areEqual(left, right)
    case '!=':
      return !areEqual(left, right)
    case '<':
      return isNull(left) || isNull(right) ? false : compare(left, right) < 0
    case '>':
      return isNull(left) || isNull(right) ? false : compare(left, right) > 0
    case '<=':
      return isNull(left) || isNull(right) ? isNull(left) && isNull(right) : compare(left, right) <= 0
    case '>=':
      return isNull(left) || isNull(right) ? isNull(left) && isNull(right) : compare(left, right) >= 0
    case '+':
      return coerceToNumber(left) + coerceToNumber(right)
    case '-':
      return coerceToNumber(left) - coerceToNumber(right)
    case '*':
      return coerceToNumber(left) * coerceToNumber(right)
    case '/':
      return coerceToNumber(left) / coerceToNumber(right)
    default:
      return coerceToNumber(left) % coerceToNumber(right)
  }
}

function isNull(value: unknown): boolean {
  return value === null || value === undefined
}

function areEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (isNull(left) || isNull(right)) return isNull(left) && isNull(right)
  if (typeof left === 'number' || typeof right === 'number') return coerceToNumber(left) === coerceToNumber(right)
  if (typeof left === 'boolean' || typeof right === 'boolean') return coerceToBoolean(left) === coerceToBoolean(right)
  if (typeof left === 'object' || typeof right === 'object') return deepEqual(left, right)
  return String(left) === String(right)
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      key =>
        hasOwn(right, key) &&
        deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  )
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === 'string' && typeof right === 'string') return left < right ? -1 : left > right ? 1 : 0
  return coerceToNumber(left) - coerceToNumber(right)
}

function coerceToNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const number = typeof value === 'number' ? value : Number(value)
  if (typeof value === 'boolean' || Number.isNaN(number)) {
    throw new JuelError(`Cannot coerce ${JSON.stringify(value)} to a number`)
  }
  return number
}

function coerceToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  throw new JuelError(`Cannot coerce ${JSON.stringify(value)} to a boolean`)
}

function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}
