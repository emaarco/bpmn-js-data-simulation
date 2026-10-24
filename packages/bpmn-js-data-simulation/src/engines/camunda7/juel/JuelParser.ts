import { JuelError } from './JuelError.js'
import { JuelLexer } from './JuelLexer.js'
import { BINARY_PRECEDENCE, type JuelNode, type JuelToken } from './juelSyntax.js'

export class JuelParser {
  private readonly tokens: JuelToken[]
  private position = 0

  constructor(source: string) {
    this.tokens = new JuelLexer().tokenize(source)
  }

  parse(): JuelNode {
    const node = this.parseExpression()
    const token = this.peek()
    if (token) throw new JuelError(`Unexpected "${token.text}"`)
    return node
  }

  private parseExpression(): JuelNode {
    const test = this.parseBinary(0)
    if (!this.accept('?')) return test
    const consequent = this.parseExpression()
    this.expect(':')
    const alternate = this.parseExpression()
    return { type: 'conditional', test, consequent, alternate }
  }

  private parseBinary(level: number): JuelNode {
    if (level === BINARY_PRECEDENCE.length) return this.parseUnary()
    let left = this.parseBinary(level + 1)
    let operator = this.acceptAny(BINARY_PRECEDENCE[level])
    while (operator) {
      const right = this.parseBinary(level + 1)
      left = { type: 'binary', operator, left, right }
      operator = this.acceptAny(BINARY_PRECEDENCE[level])
    }
    return left
  }

  private parseUnary(): JuelNode {
    const operator = this.acceptAny(['!', '-', 'empty'])
    if (operator) return { type: 'unary', operator, operand: this.parseUnary() }
    return this.parseMember()
  }

  private parseMember(): JuelNode {
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

  private parsePrimary(): JuelNode {
    const token = this.next()
    if (!token) throw new JuelError('Unexpected end of expression')
    if (token.kind === 'number' || token.kind === 'string') return { type: 'literal', value: token.value }
    if (token.kind === 'identifier') return this.identifierOrLiteral(token.text)
    if (token.text === '(') {
      const node = this.parseExpression()
      this.expect(')')
      return node
    }
    throw new JuelError(`Unexpected "${token.text}"`)
  }

  private identifierOrLiteral(name: string): JuelNode {
    if (name === 'true') return { type: 'literal', value: true }
    if (name === 'false') return { type: 'literal', value: false }
    if (name === 'null') return { type: 'literal', value: null }
    return { type: 'identifier', name }
  }

  private peek(): JuelToken | undefined {
    return this.tokens[this.position]
  }

  private next(): JuelToken | undefined {
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
