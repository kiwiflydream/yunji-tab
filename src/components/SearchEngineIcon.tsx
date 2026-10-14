import type { SearchEngine } from '~/lib/types'
import { Globe2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadFavicon } from '~/lib/favicon-cache'
import { DEFAULT_SEARCH_ENGINE_EMOJI } from '~/lib/search-engines'
import { cn } from '~/lib/utils'

interface SearchEngineIconProps {
  /** Omit for the browser's default engine. */
  engine?: SearchEngine
  className?: string
}

// Built-in engines and custom ones left on the default emoji show the site's favicon; a user-picked emoji wins.
export function SearchEngineIcon({ engine, className }: SearchEngineIconProps) {
  const customEmoji = engine?.id.startsWith('custom-') && engine.emoji !== DEFAULT_SEARCH_ENGINE_EMOJI ? engine.emoji : ''
  const siteUrl = engine && !customEmoji ? engine.url.replace('%s', '') : ''
  const [source, setSource] = useState<{ url: string, src: string } | null>(null)

  useEffect(() => {
    if (!siteUrl)
      return
    let active = true
    let objectUrl = ''
    void loadFavicon(siteUrl).then((blob) => {
      if (!active)
        return
      objectUrl = URL.createObjectURL(blob)
      setSource({ url: siteUrl, src: objectUrl })
    }).catch(() => undefined)
    return () => {
      active = false
      if (objectUrl)
        URL.revokeObjectURL(objectUrl)
    }
  }, [siteUrl])

  const box = cn('flex size-4 shrink-0 items-center justify-center', className)
  if (customEmoji)
    return <span aria-hidden="true" className={cn(box, 'text-sm leading-none')}>{customEmoji}</span>
  if (!engine)
    return <Globe2 aria-hidden="true" strokeWidth={1.75} className={cn(box, 'text-muted-foreground')} />
  if (source?.url === siteUrl)
    return <img src={source.src} alt="" aria-hidden="true" className={cn(box, 'rounded-[3px] object-contain')} />
  return <Search aria-hidden="true" strokeWidth={1.75} className={cn(box, 'text-muted-foreground')} />
}
