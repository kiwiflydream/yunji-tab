import type { BookmarkGroupMember } from '~/lib/bookmark-groups'
import type { Placement } from '~/lib/graphic-placement'
import type { AppearanceSettings } from '~/lib/types'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { iconSizeClass } from '~/lib/appearance'
import { placementStyle } from '~/lib/graphic-placement'
import { cn } from '~/lib/utils'

const STACK_LIMIT = 3

// Cards pivot from a point below the stack, so rotation alone fans them like a hand; the first member sits in front.
const placements: Record<number | 'backing', Placement[]> = {
  0: [{ x: 6, r: -14, y: 6, hx: -10, hy: 0, hr: -22 }, { x: 34, r: 14, y: 6, hx: 10, hy: 0, hr: 22 }, { x: 20, hy: -10 }],
  1: [{ x: 20, hy: -10 }],
  // A lone member keeps a blank card behind it, so it still reads as a group.
  backing: [{ x: 12, r: -12, y: 4, hx: -8, hy: -2, hr: -20 }],
  2: [{ x: 8, r: -10, y: 4, hx: -8, hy: -2, hr: -18 }, { x: 32, r: 10, hx: 8, hy: -8, hr: 16 }],
  3: [{ x: 6, r: -14, y: 6, hx: -10, hy: 0, hr: -22 }, { x: 34, r: 14, y: 6, hx: 10, hy: 0, hr: 22 }, { x: 20, hy: -10 }],
}

interface GroupStackGraphicProps {
  appearance: AppearanceSettings
  compact: boolean
  members: BookmarkGroupMember[]
}

/**
 * A group's default icon: its first sites held like a small hand of cards (blank cards for an empty group).
 * Hovering or focusing the surrounding card spreads the hand; see `.group-stack` in main.css.
 */
export function GroupStackGraphic({ appearance, compact, members }: GroupStackGraphicProps) {
  const shown = members.slice(0, STACK_LIMIT)
  // Back cards first so the first member paints on top.
  const cards = shown.length === STACK_LIMIT ? [shown[1], shown[2], shown[0]] : shown.toReversed()
  const sizes = iconSizeClass[appearance.iconSize]
  return (
    <div data-slot="bookmark-icon" aria-hidden="true" className={cn('group-stack shrink-0', compact ? sizes.compact : sizes.grid, 'rounded-none')}>
      {cards.length === 1 ? <span className="group-stack-card group-stack-blank" style={placementStyle(placements.backing[0], 0)} /> : null}
      {cards.length > 0
        ? cards.map((member, index) => (
            <span key={member.id ?? member.url} className="group-stack-card" style={placementStyle(placements[cards.length][index], index)}>
              <BookmarkIcon
                url={member.url}
                name={member.title}
                appearance={appearance}
                className="size-full rounded-[inherit] bg-card bg-none text-[10px] shadow-none ring-0"
                imageClassName="size-[64%]"
                slot="group-member-icon"
              />
            </span>
          ))
        : placements[0].map((placement, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed decorative cards
            <span key={index} className="group-stack-card group-stack-blank" style={placementStyle(placement, index)} />
          ))}
    </div>
  )
}
