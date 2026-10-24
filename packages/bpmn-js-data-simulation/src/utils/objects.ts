export function hasOwn(object: object, key: string | number): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export function deepEqual(left: unknown, right: unknown): boolean {
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
