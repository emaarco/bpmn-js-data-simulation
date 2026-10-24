export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Placement {
  left: number
  top: number
  maxHeight: number | undefined
  hidden: boolean
}

const GAP = 12
const MARGIN = 8

export function placePopover(anchor: Box, popover: Size, bounds: Size): Placement {
  const below = anchor.y + anchor.height + GAP
  const above = anchor.y - GAP - popover.height
  const fitsBelow = below + popover.height <= bounds.height - MARGIN
  const fitsAbove = above >= MARGIN
  const height = Math.min(popover.height, bounds.height - 2 * MARGIN)
  return {
    left: clamp(anchor.x + anchor.width / 2 - popover.width / 2, MARGIN, bounds.width - popover.width - MARGIN),
    top: fitsBelow ? below : fitsAbove ? above : clamp(below, MARGIN, bounds.height - height - MARGIN),
    maxHeight: height < popover.height ? height : undefined,
    hidden: !isInView(anchor, bounds),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function isInView(anchor: Box, bounds: Size): boolean {
  return (
    anchor.x + anchor.width > 0 && anchor.x < bounds.width && anchor.y + anchor.height > 0 && anchor.y < bounds.height
  )
}
