import type { CollisionDetection, DragCancelEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { DragItemData } from '~/lib/drag-drop'
import type { MessageKey, TranslationParams } from '~/lib/i18n'
import {

  DndContext,

  DragOverlay,

  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CheckCircle2, FolderInput, GripVertical, XCircle } from 'lucide-react'

import { useEffect, useState } from 'react'
import { MovePendingContext } from '~/components/BookmarkDragDropContext'
import {

  readBookmarkDropData,
  readCategoryDropData,
  readDragItemData,
  validateBookmarkDrop,
  validateCategoryDrop,
} from '~/lib/drag-drop'
import { useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkDragDropProviderProps {
  children: ReactNode
}

interface Notice {
  kind: 'success' | 'error'
  key: MessageKey
  params?: TranslationParams
}

const categoryCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0
    ? pointerCollisions
    : rectIntersection(args)
}

export function BookmarkDragDropProvider({
  children,
}: BookmarkDragDropProviderProps) {
  const { t } = useI18n()
  const categories = useCategories()
  const updateBookmark = useNavStore(state => state.updateBookmark)
  const updateCategory = useNavStore(state => state.updateCategory)
  const reorderBookmark = useNavStore(state => state.reorderBookmark)
  const reorderPinnedBookmark = useNavStore(state => state.reorderPinnedBookmark)
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null)
  const [moving, setMoving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    if (!notice)
      return
    const timer = window.setTimeout(setNotice, 2800, null)
    return () => window.clearTimeout(timer)
  }, [notice])

  const handleDragStart = ({ active }: DragStartEvent) => {
    const item = readDragItemData(active.data.current)
    setActiveItem(item)
    setNotice(null)
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveItem(null)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const item = readDragItemData(active.data.current)
    const bookmarkTarget = readBookmarkDropData(over?.data.current)
    const categoryTarget = readCategoryDropData(over?.data.current)
    setActiveItem(null)

    if (!item)
      return

    if (bookmarkTarget) {
      const validation = validateBookmarkDrop(item, bookmarkTarget)
      if (validation.status === 'invalid') {
        setNotice({ kind: 'error', key: validation.messageKey, params: validation.params })
        return
      }
      if (validation.status === 'noop')
        return

      setMoving(true)
      try {
        if (item.type !== 'bookmark')
          return
        await (item.pinnedReorder ? reorderPinnedBookmark : reorderBookmark)(
          item.bookmarkId,
          bookmarkTarget.bookmarkId,
        )
        setNotice({
          kind: 'success',
          key: validation.completedMessageKey ?? validation.messageKey,
          params: validation.params,
        })
      }
      catch {
        setNotice({ kind: 'error', key: 'dragMoveFailed' })
      }
      finally {
        setMoving(false)
      }
      return
    }

    if (!categoryTarget)
      return
    const validation = validateCategoryDrop(
      item,
      categoryTarget.categoryId,
      categories,
    )
    if (validation.status === 'invalid') {
      setNotice({ kind: 'error', key: validation.messageKey, params: validation.params })
      return
    }
    if (validation.status === 'noop') {
      setNotice({ kind: 'success', key: validation.messageKey, params: validation.params })
      return
    }

    setMoving(true)
    try {
      if (item.type === 'bookmark') {
        await updateBookmark(item.bookmarkId, {
          categoryId: categoryTarget.categoryId,
        })
      }
      else {
        await updateCategory(item.categoryId, {
          parentId: categoryTarget.categoryId,
        })
      }
      setNotice({
        kind: 'success',
        key: validation.completedMessageKey ?? validation.messageKey,
        params: validation.params,
      })
    }
    catch {
      setNotice({ kind: 'error', key: 'dragMoveFailed' })
    }
    finally {
      setMoving(false)
    }
  }

  return (
    <MovePendingContext.Provider value={moving}>
      <DndContext
        sensors={sensors}
        collisionDetection={categoryCollisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={event => void handleDragEnd(event)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              t('dragScreenReaderInstructions'),
          },
          announcements: {
            onDragStart({ active }) {
              const item = readDragItemData(active.data.current)
              return item
                ? t('dragStartedNamed', { name: item.label })
                : t('dragStarted')
            },
            onDragOver({ active, over }) {
              const item = readDragItemData(active.data.current)
              const bookmarkTarget = readBookmarkDropData(over?.data.current)
              if (item && bookmarkTarget) {
                const result = validateBookmarkDrop(item, bookmarkTarget)
                return t(result.messageKey, result.params)
              }
              const categoryTarget = readCategoryDropData(over?.data.current)
              if (!item || !categoryTarget)
                return t('dragNoDropPosition')
              const result = validateCategoryDrop(
                item,
                categoryTarget.categoryId,
                categories,
              )
              return t(result.messageKey, result.params)
            },
            onDragEnd({ active, over }) {
              const item = readDragItemData(active.data.current)
              const bookmarkTarget = readBookmarkDropData(over?.data.current)
              if (item && bookmarkTarget) {
                const result = validateBookmarkDrop(item, bookmarkTarget)
                return t(result.messageKey, result.params)
              }
              const categoryTarget = readCategoryDropData(over?.data.current)
              if (!item || !categoryTarget)
                return t('dragEndedWithoutMove')
              const result = validateCategoryDrop(
                item,
                categoryTarget.categoryId,
                categories,
              )
              return t(result.messageKey, result.params)
            },
            onDragCancel({ active }) {
              const item = readDragItemData(active.data.current)
              return item
                ? t('dragCancelledNamed', { name: item.label })
                : t('dragCancelled')
            },
          },
        }}
      >
        {children}

        <DragOverlay dropAnimation={null}>
          {activeItem
            ? (
                <div className="flex max-w-xs items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium shadow-xl">
                  {activeItem.type === 'bookmark' && activeItem.reorderEnabled
                    ? (
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )
                    : (
                        <FolderInput className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                  <span className="truncate">{activeItem.label}</span>
                </div>
              )
            : null}
        </DragOverlay>

        {notice
          ? (
              <div
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className="fixed bottom-5 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium shadow-xl"
              >
                {notice.kind === 'error'
                  ? (
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )
                  : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    )}
                <span className="min-w-0 break-words">{t(notice.key, notice.params)}</span>
              </div>
            )
          : null}
      </DndContext>
    </MovePendingContext.Provider>
  )
}
