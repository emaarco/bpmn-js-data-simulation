interface Point {
  x: number
  y: number
}

export function badgePosition(waypoints: Point[], distanceFromStart: number): { left: number; top: number } {
  const [start, next] = waypoints
  const length = Math.hypot(next.x - start.x, next.y - start.y) || 1
  const distance = Math.min(distanceFromStart, length / 2)
  const x = start.x + ((next.x - start.x) / length) * distance
  const y = start.y + ((next.y - start.y) / length) * distance
  const minX = Math.min(...waypoints.map(point => point.x))
  const minY = Math.min(...waypoints.map(point => point.y))
  return { left: x - minX, top: y - minY }
}
