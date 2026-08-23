import type { MessageKey, TranslationParams } from '~/lib/i18n'
import type { Bookmark, Category } from '~/lib/types'
import { useMemo, useState } from 'react'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BulkMessage {
  key: MessageKey
  params?: TranslationParams
}

interface BookmarkBulkActionsOptions {
  activeCategoryId: string
  bookmarks: Bookmark[]
  categories: Category[]
  visibleBookmarkIds: string[]
}

export function useBookmarkBulkActions({
  activeCategoryId,
  bookmarks,
  categories,
  visibleBookmarkIds,
}: BookmarkBulkActionsOptions) {
  const { t } = useI18n()
  const moveBookmarks = useNavStore(state => state.moveBookmarks)
  const removeBookmarks = useNavStore(state => state.removeBookmarks)
  const syncBookmarkDescriptions = useNavStore(
    state => state.syncBookmarkDescriptions,
  )
  const recordBookmarkOpen = useNavStore(state => state.recordBookmarkOpen)
  const markBookmarksOrganized = useNavStore(
    state => state.markBookmarksOrganized,
  )
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [destinationId, setDestinationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<BulkMessage | null>(null)

  const resolvedDestinationId = categories.some(
    category => category.id === destinationId,
  )
    ? destinationId
    : ''
  const allVisibleSelected
    = visibleBookmarkIds.length > 0
      && visibleBookmarkIds.every(id => selectedIds.has(id))
  const selectedBookmarks = useMemo(
    () => bookmarks.filter(bookmark => selectedIds.has(bookmark.id)),
    [bookmarks, selectedIds],
  )

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionMode(false)
    setDestinationId('')
  }
  const startSelection = () => {
    setSelectionMode(true)
    setDestinationId('')
    setMessage(null)
  }
  const cancelSelection = () => {
    clearSelection()
    setMessage(null)
  }
  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected)
        visibleBookmarkIds.forEach(id => next.delete(id))
      else visibleBookmarkIds.forEach(id => next.add(id))
      return next
    })
  }
  const toggleBookmark = (bookmarkId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(bookmarkId))
        next.delete(bookmarkId)
      else next.add(bookmarkId)
      return next
    })
  }

  const run = async (
    action: () => Promise<{ clearSelection?: boolean, message: BulkMessage }>,
    failureKey: MessageKey,
  ) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      if (result.clearSelection)
        clearSelection()
      setMessage(result.message)
    }
    catch {
      setMessage({ key: failureKey })
    }
    finally {
      setBusy(false)
    }
  }
  const move = () => {
    if (!resolvedDestinationId)
      return Promise.resolve()
    const count = selectedIds.size
    return run(async () => {
      await moveBookmarks([...selectedIds], resolvedDestinationId)
      return {
        clearSelection: true,
        message: { key: 'bulkMovedCount', params: { count } },
      }
    }, 'bulkMoveFailed')
  }
  const remove = () => {
    const count = selectedIds.size
    return run(async () => {
      await removeBookmarks([...selectedIds])
      return {
        clearSelection: true,
        message: { key: 'bulkDeletedCount', params: { count } },
      }
    }, 'bulkDeleteFailed')
  }
  const sync = () =>
    run(async () => {
      const result = await syncBookmarkDescriptions([...selectedIds])
      return {
        message: {
          key: 'bulkSyncResult',
          params: { attempted: result.attempted, updated: result.updated },
        },
      }
    }, 'bulkSyncFailed')
  const open = () =>
    run(async () => {
      await Promise.all(
        selectedBookmarks.map(async (bookmark) => {
          void recordBookmarkOpen(bookmark.url).catch(() => undefined)
          await openBookmarkUrl(bookmark)
        }),
      )
      return {
        message: {
          key: 'bulkOpenedCount',
          params: { count: selectedBookmarks.length },
        },
      }
    }, 'bulkOpenFailed')
  const organize = () => {
    const count = selectedIds.size
    return run(async () => {
      await markBookmarksOrganized([...selectedIds])
      return {
        clearSelection: true,
        message: { key: 'bulkOrganizedCount', params: { count } },
      }
    }, 'bulkOrganizeFailed')
  }

  return {
    allVisibleSelected,
    busy,
    cancelSelection,
    destinationId: resolvedDestinationId,
    message: message ? t(message.key, message.params) : '',
    move,
    open,
    organize: activeCategoryId === 'inbox' ? organize : undefined,
    remove,
    selectedCount: selectedIds.size,
    selectedIds,
    selectionMode,
    setDestinationId,
    startSelection,
    sync,
    toggleAll,
    toggleBookmark,
  }
}
