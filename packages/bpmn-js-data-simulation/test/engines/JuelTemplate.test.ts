import { describe, expect, it } from 'vitest'
import { JuelTemplate } from '../../src/engines/camunda7/juel/JuelTemplate'

function juel(text: string, variables: Record<string, unknown> = {}): unknown {
  return JuelTemplate.parse(text).evaluate(variables)
}

describe('JUEL subset', () => {
  it.each([
    ['${1 + 2 * 3}', 7],
    ['${(1 + 2) * 3}', 9],
    ['${10 / 4}', 2.5],
    ['${10 div 4}', 2.5],
    ['${10 % 4}', 2],
    ['${10 mod 4}', 2],
    ['${-amount}', -5],
    ['${amount > 3 && amount < 10}', true],
    ['${amount gt 3 and amount lt 4}', false],
    ['${amount ge 5 or false}', true],
    ['${amount == 5}', true],
    ['${amount eq "5"}', true],
    ['${amount != 5}', false],
    ['${!flag}', false],
    ['${not flag}', false],
    ["${name == 'Ada'}", true],
    ["${customer.tier == 'gold'}", true],
    ["${customer['tier']}", 'gold'],
    ['${items[1]}', 'b'],
    ['${empty items}', false],
    ['${empty missingList}', true],
    ['${not empty items}', true],
    ['${amount > 3 ? "big" : "small"}', 'big'],
    ['${null == nothing}', true],
    ['#{amount}', 5],
    ['${customer.missing == null}', true],
    ['${items[5] == null}', true],
    ['${nothing > 3}', false],
    ['${nothing <= nothing}', true],
    ["${'a' < 'B'}", false],
    ["${'TRUE' && flag}", true],
    ['${customer == customer}', true],
    ['${customer == items}', false],
    ["${'yes' || false}", false],
    ['${pair == swapped}', true],
  ])('evaluates %s', (expression, expected) => {
    expect(
      juel(expression, {
        amount: 5,
        flag: true,
        name: 'Ada',
        customer: { tier: 'gold' },
        items: ['a', 'b'],
        missingList: [],
        nothing: null,
        pair: { a: 1, b: 2 },
        swapped: { b: 2, a: 1 },
      }),
    ).toEqual(expected)
  })

  it('treats text outside of expressions as a string literal', () => {
    expect(juel('plain text')).toBe('plain text')
    expect(juel('Order ${id} for ${name}', { id: 7, name: 'Ada' })).toBe('Order 7 for Ada')
  })

  it('reads a closing brace inside a string literal as part of the string', () => {
    expect(juel("${'}' == '}'}")).toBe(true)
  })

  it.each([
    ['${execution.getVariable("x")}', 'Method calls are not supported'],
    ['${amount >}', 'Unexpected end of expression'],
    ['${amount', 'Unterminated expression'],
    ["${'open}", 'Unterminated'],
    ['${amount @ 2}', 'Unexpected character "@"'],
    ['${a b}', 'Unexpected "b"'],
  ])('rejects %s at parse time', (expression, message) => {
    expect(() => JuelTemplate.parse(expression)).toThrow(message)
  })

  it('reads properties of null as null, like EL', () => {
    expect(juel('${customer.tier}', { customer: null })).toBeNull()
  })

  it.each([
    ['${unknown}', {}, 'Unknown property used in expression: unknown'],
    ['${constructor}', {}, 'Unknown property used in expression: constructor'],
    ["${'x' + 1}", {}, 'Cannot coerce "x" to a number'],
    ['${!5}', {}, 'Cannot coerce 5 to a boolean'],
  ])('fails at evaluation time for %s', (expression, variables, message) => {
    expect(() => juel(expression, variables)).toThrow(message)
  })
})
