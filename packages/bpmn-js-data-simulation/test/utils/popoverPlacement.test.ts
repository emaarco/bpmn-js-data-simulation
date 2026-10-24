import { describe, expect, it } from 'vitest'
import { placePopover } from '../../src/utils/popoverPlacement'

const bounds = { width: 800, height: 400 }
const card = { width: 300, height: 200 }

describe('placePopover', () => {
  it('opens below the anchor when there is room', () => {
    expect(placePopover({ x: 100, y: 50, width: 50, height: 50 }, card, bounds)).toEqual({
      left: 8,
      top: 112,
      maxHeight: undefined,
      hidden: false,
    })
  })

  it('opens above the anchor when there is no room below', () => {
    expect(placePopover({ x: 400, y: 300, width: 50, height: 50 }, card, bounds)).toMatchObject({
      left: 275,
      top: 88,
      maxHeight: undefined,
    })
  })

  it('keeps it inside the canvas on the right', () => {
    expect(placePopover({ x: 760, y: 50, width: 50, height: 50 }, card, bounds).left).toBe(492)
  })

  it('shifts into the canvas, over the anchor, when neither side fits', () => {
    const tall = { width: 300, height: 300 }
    expect(placePopover({ x: 400, y: 150, width: 50, height: 50 }, tall, bounds)).toMatchObject({
      top: 92,
      maxHeight: undefined,
    })
  })

  it('scrolls only when it is taller than the canvas', () => {
    const taller = { width: 300, height: 500 }
    expect(placePopover({ x: 400, y: 150, width: 50, height: 50 }, taller, bounds)).toMatchObject({
      top: 8,
      maxHeight: 384,
    })
  })

  it('hides it while the anchor is out of view', () => {
    expect(placePopover({ x: 900, y: 50, width: 50, height: 50 }, card, bounds).hidden).toBe(true)
  })
})
