const NICE_STEPS = [1, 2, 5, 10]

export function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return NICE_STEPS.find(step => step * magnitude >= value)! * magnitude
}

export function numberLiterals(expression: string): number[] {
  return (expression.match(/(?<![\w.])\d+(?:\.\d+)?/g) ?? []).map(Number)
}
