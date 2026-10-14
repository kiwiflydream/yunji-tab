import type { Placement } from '~/lib/graphic-placement'
import type { AppearanceSettings, Bookmark } from '~/lib/types'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { iconSizeClass } from '~/lib/appearance'
import { placementStyle } from '~/lib/graphic-placement'
import { cn } from '~/lib/utils'

// Resting and hovered placement per item, by how many items the folder shows; percentages of the graphic.
const placements: Record<number, Placement[]> = {
  1: [{ x: 28, hy: -40 }],
  2: [{ x: 16, r: -7, hx: -10, hy: -30, hr: -14 }, { x: 40, r: 7, hx: 10, hy: -30, hr: 14 }],
  3: [{ x: 8, r: -8, hx: -14, hy: -30, hr: -16 }, { x: 28, y: -10, hy: -42 }, { x: 48, r: 8, hx: 14, hy: -30, hr: 16 }],
}
const paperPlacements: Placement[] = [{ x: 12, hy: -26, hr: -6 }, { x: 38, r: 6, hy: -34, hr: 10 }]

interface FolderGraphicProps {
  appearance: AppearanceSettings
  /** User-picked emoji, shown on the front flap; omitted for untouched folders. */
  emoji?: string
  previewBookmarks?: Bookmark[]
}

/**
 * A small open folder with its first site icons peeking out (plain sheets when it holds no bookmarks).
 * Hovering or focusing the surrounding `.folder-card` tips the flap open and fans the contents up; see main.css.
 */
export function FolderGraphic({ appearance, emoji, previewBookmarks = [] }: FolderGraphicProps) {
  return (
    <div
      data-slot="folder-card-icon"
      aria-hidden="true"
      className={cn('folder-graphic shrink-0', iconSizeClass[appearance.iconSize].grid, 'rounded-none')}
    >
      <span className="folder-graphic-back" />
      {previewBookmarks.length > 0
        ? previewBookmarks.map((bookmark, index) => (
            <span key={bookmark.id} className="folder-graphic-item" style={placementStyle(placements[previewBookmarks.length][index], index)}>
              <BookmarkIcon
                icon={bookmark.icon}
                url={bookmark.url}
                name={bookmark.name}
                appearance={appearance}
                className="size-full rounded-[inherit] bg-card bg-none text-[10px] shadow-none ring-0"
                imageClassName="size-[68%]"
                slot="folder-preview-icon"
              />
            </span>
          ))
        : paperPlacements.map((placement, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed decorative sheets
            <span key={index} className="folder-graphic-item folder-graphic-paper" style={placementStyle(placement, index)} />
          ))}
      <span className="folder-graphic-front">
        {emoji ? <span className="folder-graphic-emoji">{emoji}</span> : null}
      </span>
    </div>
  )
}
