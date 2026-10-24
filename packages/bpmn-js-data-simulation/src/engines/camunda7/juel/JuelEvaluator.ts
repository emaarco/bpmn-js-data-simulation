import type { Variables } from '../../../domain/model.js'
import { deepEqual, hasOwn } from '../../../utils/objects.js'
import { JuelError } from './JuelError.js'
import type { JuelNode } from './juelSyntax.js'

type BinaryNode = Extract<JuelNode, { type: 'binary' }>

export class JuelEvaluator {
  constructor(private readonly variables: Variables) {}

  evaluate(node: JuelNode): unknown {
    switch (node.type) {
      case 'literal':
        return node.value
      case 'identifier':
        if (!hasOwn(this.variables, node.name)) {
          throw new JuelError(`Unknown property used in expression: ${node.name}`)
        }
        return this.variables[node.name]
      case 'member':
        return this.readMember(this.evaluate(node.object), this.evaluate(node.property))
      case 'unary':
        return this.evaluateUnary(node.operator, this.evaluate(node.operand))
      case 'conditional':
        return this.coerceToBoolean(this.evaluate(node.test))
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate)
      case 'binary':
        return this.evaluateBinary(node)
    }
  }

  coerceToString(value: unknown): string {
    if (value === null || value === undefined) return ''
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  private readMember(object: unknown, property: unknown): unknown {
    if (object === null || object === undefined) return null
    const key = Array.isArray(object) ? Number(property) : String(property)
    return hasOwn(object as object, key) ? ((object as Record<string | number, unknown>)[key] ?? null) : null
  }

  private evaluateUnary(operator: string, operand: unknown): unknown {
    if (operator === '!') return !this.coerceToBoolean(operand)
    if (operator === '-') return -this.coerceToNumber(operand)
    return this.isEmpty(operand)
  }

  private evaluateBinary(node: BinaryNode): unknown {
    const { operator } = node
    if (operator === '&&') {
      return this.coerceToBoolean(this.evaluate(node.left)) && this.coerceToBoolean(this.evaluate(node.right))
    }
    if (operator === '||') {
      return this.coerceToBoolean(this.evaluate(node.left)) || this.coerceToBoolean(this.evaluate(node.right))
    }
    const left = this.evaluate(node.left)
    const right = this.evaluate(node.right)
    const eitherIsNull = this.isNull(left) || this.isNull(right)
    const bothAreNull = this.isNull(left) && this.isNull(right)
    switch (operator) {
      case '==':
        return this.areEqual(left, right)
      case '!=':
        return !this.areEqual(left, right)
      case '<':
        return eitherIsNull ? false : this.compare(left, right) < 0
      case '>':
        return eitherIsNull ? false : this.compare(left, right) > 0
      case '<=':
        return eitherIsNull ? bothAreNull : this.compare(left, right) <= 0
      case '>=':
        return eitherIsNull ? bothAreNull : this.compare(left, right) >= 0
      case '+':
        return this.coerceToNumber(left) + this.coerceToNumber(right)
      case '-':
        return this.coerceToNumber(left) - this.coerceToNumber(right)
      case '*':
        return this.coerceToNumber(left) * this.coerceToNumber(right)
      case '/':
        return this.coerceToNumber(left) / this.coerceToNumber(right)
      default:
        return this.coerceToNumber(left) % this.coerceToNumber(right)
    }
  }

  private isNull(value: unknown): boolean {
    return value === null || value === undefined
  }

  private areEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true
    if (this.isNull(left) || this.isNull(right)) return this.isNull(left) && this.isNull(right)
    if (typeof left === 'number' || typeof right === 'number') {
      return this.coerceToNumber(left) === this.coerceToNumber(right)
    }
    if (typeof left === 'boolean' || typeof right === 'boolean') {
      return this.coerceToBoolean(left) === this.coerceToBoolean(right)
    }
    if (typeof left === 'object' || typeof right === 'object') return deepEqual(left, right)
    return String(left) === String(right)
  }

  private compare(left: unknown, right: unknown): number {
    if (typeof left === 'string' && typeof right === 'string') return left < right ? -1 : left > right ? 1 : 0
    return this.coerceToNumber(left) - this.coerceToNumber(right)
  }

  private coerceToNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    const number = typeof value === 'number' ? value : Number(value)
    if (typeof value === 'boolean' || Number.isNaN(number)) {
      throw new JuelError(`Cannot coerce ${JSON.stringify(value)} to a number`)
    }
    return number
  }

  private coerceToBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (value === null || value === undefined || value === '') return false
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    throw new JuelError(`Cannot coerce ${JSON.stringify(value)} to a boolean`)
  }

  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }
}
