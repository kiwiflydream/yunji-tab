import type { AppearanceSettings } from '~/lib/types'
import { useEffect, useRef, useState } from 'react'
import { iconSizeClass } from '~/lib/appearance'
import { loadCustomIcon, loadFavicon } from '~/lib/favicon-cache'
import { observeSharedIntersection } from '~/lib/shared-intersection-observer'
import { cn } from '~/lib/utils'

interface BookmarkIconProps {
  icon?: string
  url?: string
  name: string
  appearance: AppearanceSettings
  compact?: boolean
  fallbackIcon?: string
}

export function BookmarkIcon({ icon, url, name, appearance, compact = false, fallbackIcon }: BookmarkIconProps) {
  const node = useRef<HTMLDivElement | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)
  const remoteIcon = /^https?:\/\//i.test(icon ?? '')
  const textIcon = icon && !remoteIcon ? icon : undefined
  const hasImage = remoteIcon || (!textIcon && Boolean(url))
  const sizes = iconSizeClass[appearance.iconSize]

  useEffect(() => {
    if (!hasImage || !node.current)
      return
    return observeSharedIntersection(node.current, () => setShouldLoad(true))
  }, [hasImage])

  useEffect(() => {
    if (!hasImage || !shouldLoad)
      return
    let active = true
    let objectUrl = ''
    setSource('')
    setFailed(false)
    const request = url ? loadFavicon(url, remoteIcon ? icon : undefined) : loadCustomIcon(icon!)
    void request.then((blob) => {
      if (!active)
        return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch(() => {
      if (active)
        setFailed(true)
    })
    return () => {
      active = false
      if (objectUrl)
        URL.revokeObjectURL(objectUrl)
    }
  }, [hasImage, icon, remoteIcon, shouldLoad, url])

  return (
    <div
      ref={node}
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/85 to-secondary/40 text-foreground ring-1 ring-border/45 shadow-xs group-hover:ring-border/65 transition-all',
        compact ? sizes.compact : sizes.grid,
      )}
    >
      {textIcon
        ? <span>{textIcon}</span>
        : failed || !hasImage
          ? <span className={fallbackIcon ? undefined : 'text-xs font-semibold tracking-wider text-muted-foreground/90'}>{fallbackIcon ?? name.slice(0, 1).toUpperCase()}</span>
          : source
            ? <img src={source} alt="" className={cn(compact ? sizes.imageCompact : sizes.imageGrid, 'object-contain')} onError={() => setFailed(true)} />
            : <span className="size-7 animate-pulse rounded-lg bg-muted/60" />}
    </div>
  )
}
