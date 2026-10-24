import type { Variables } from '../../../domain/model.js'
import { JuelError } from './JuelError.js'
import { JuelEvaluator } from './JuelEvaluator.js'
import { JuelParser } from './JuelParser.js'
import type { JuelNode } from './juelSyntax.js'

type TemplatePart = string | JuelNode

export class JuelTemplate {
  private constructor(private readonly parts: TemplatePart[]) {}

  static parse(text: string): JuelTemplate {
    const parts: TemplatePart[] = []
    let cursor = 0
    while (cursor < text.length) {
      const start = JuelTemplate.findExpressionStart(text, cursor)
      if (start === -1) {
        parts.push(text.slice(cursor))
        break
      }
      if (start > cursor) parts.push(text.slice(cursor, start))
      const end = JuelTemplate.findExpressionEnd(text, start + 2)
      parts.push(new JuelParser(text.slice(start + 2, end)).parse())
      cursor = end + 1
    }
    return new JuelTemplate(parts)
  }

  evaluate(variables: Variables): unknown {
    const evaluator = new JuelEvaluator(variables)
    const [onlyPart] = this.parts
    if (this.parts.length === 1 && typeof onlyPart !== 'string') {
      return evaluator.evaluate(onlyPart)
    }
    return this.parts
      .map(part => (typeof part === 'string' ? part : evaluator.coerceToString(evaluator.evaluate(part))))
      .join('')
  }

  variableNames(): string[] {
    const names = new Set<string>()
    const visit = (node: JuelNode): void => {
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
    this.parts.forEach(part => typeof part !== 'string' && visit(part))
    return [...names]
  }

  private static findExpressionStart(text: string, from: number): number {
    const dollar = text.indexOf('${', from)
    const hash = text.indexOf('#{', from)
    if (dollar === -1) return hash
    if (hash === -1) return dollar
    return Math.min(dollar, hash)
  }

  private static findExpressionEnd(text: string, from: number): number {
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
}
