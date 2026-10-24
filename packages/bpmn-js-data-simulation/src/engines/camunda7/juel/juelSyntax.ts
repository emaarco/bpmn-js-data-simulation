export type JuelNode =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: JuelNode; property: JuelNode }
  | { type: 'unary'; operator: string; operand: JuelNode }
  | { type: 'binary'; operator: string; left: JuelNode; right: JuelNode }
  | { type: 'conditional'; test: JuelNode; consequent: JuelNode; alternate: JuelNode }

export interface JuelToken {
  kind: 'number' | 'string' | 'identifier' | 'operator'
  text: string
  value?: unknown
}

export const KEYWORD_OPERATORS: Record<string, string> = {
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

export const SYMBOL_OPERATORS = [
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

export const BINARY_PRECEDENCE: string[][] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '>', '<=', '>='],
  ['+', '-'],
  ['*', '/', '%'],
]
