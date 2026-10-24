import { hasOwn } from '../../../utils/objects.js'
import { JuelError } from './JuelError.js'
import { type JuelToken, KEYWORD_OPERATORS, SYMBOL_OPERATORS } from './juelSyntax.js'

export class JuelLexer {
  tokenize(source: string): JuelToken[] {
    const tokens: JuelToken[] = []
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
        const { value, length } = this.readString(source, index)
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

  private readString(source: string, start: number): { value: string; length: number } {
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
}
