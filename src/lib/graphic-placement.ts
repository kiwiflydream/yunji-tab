import type { CSSProperties } from 'react'

/** Where one item of a small card graphic rests and where it moves on hover; percentages and degrees. */
export interface Placement { x: number, r?: number, y?: number, hx?: number, hy: number, hr?: number }

/** Hands a placement to CSS as custom properties: resting `--x/--y/--r`, hovered `--hx/--hy/--hr`, staggered `--delay`. */
export function placementStyle(placement: Placement, index: number): CSSProperties {
  return {
    '--x': `${placement.x}%`,
    '--r': `${placement.r ?? 0}deg`,
    '--y': `${placement.y ?? 0}%`,
    '--hx': `${placement.hx ?? 0}%`,
    '--hy': `${placement.hy}%`,
    '--hr': `${placement.hr ?? 0}deg`,
    '--delay': `${index * 30}ms`,
  } as CSSProperties
}
