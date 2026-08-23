import type { Category } from '~/lib/types'
import { FolderPen, Trash2 } from 'lucide-react'

import { useEffect, useMemo, useReducer } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { DEFAULT_CATEGORY_EMOJI } from '~/lib/default-data'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface CategoryDialogProps {
  category: Category | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function collectCategoryIds(
  rootId: string,
  categories: Category[],
): Set<string> {
  const ids = new Set([rootId])
  let previousSize = 0

  while (ids.size !== previousSize) {
    previousSize = ids.size
    for (const category of categories) {
      if (ids.has(category.parentId))
        ids.add(category.id)
    }
  }

  return ids
}

function getCategoryPath(
  category: Category,
  categoryById: Map<string, Category>,
  formatName: (category: Category) => string,
): string {
  const names = [formatName(category)]
  const visited = new Set([category.id])
  let parentId = category.parentId

  while (parentId !== 'all') {
    const parent = categoryById.get(parentId)
    if (!parent || visited.has(parent.id))
      break
    names.unshift(formatName(parent))
    visited.add(parent.id)
    parentId = parent.parentId
  }

  return names.join(' / ')
}

interface CategoryDialogState {
  confirmingDelete: boolean
  emoji: string
  error: string
  name: string
  parentId: string
  saving: boolean
}

type CategoryDialogAction
  = | { category: Category, type: 'reset' }
    | { patch: Partial<CategoryDialogState>, type: 'patch' }

const initialCategoryDialogState: CategoryDialogState = {
  confirmingDelete: false,
  emoji: DEFAULT_CATEGORY_EMOJI,
  error: '',
  name: '',
  parentId: '',
  saving: false,
}

function categoryDialogReducer(
  state: CategoryDialogState,
  action: CategoryDialogAction,
): CategoryDialogState {
  if (action.type === 'reset') {
    return {
      confirmingDelete: false,
      emoji: action.category.emoji,
      error: '',
      name: action.category.name,
      parentId: action.category.parentId,
      saving: false,
    }
  }
  return { ...state, ...action.patch }
}

export function CategoryDialog({
  category,
  open,
  onOpenChange,
}: CategoryDialogProps) {
  const { categoryName, t } = useI18n()
  const categories = useCategories()
  const bookmarks = useBookmarks()
  const updateCategory = useNavStore(state => state.updateCategory)
  const removeCategory = useNavStore(state => state.removeCategory)
  const [state, dispatch] = useReducer(
    categoryDialogReducer,
    initialCategoryDialogState,
  )
  const { confirmingDelete, emoji, error, name, parentId, saving } = state

  useEffect(() => {
    if (!open || !category)
      return
    dispatch({ category, type: 'reset' })
  }, [category, open])

  const categoryById = useMemo(
    () => new Map(categories.map(item => [item.id, item])),
    [categories],
  )
  const unavailableIds = useMemo(
    () =>
      category
        ? collectCategoryIds(category.id, categories)
        : new Set<string>(),
    [categories, category],
  )
  const parentOptions = categories.filter(
    candidate =>
      !unavailableIds.has(candidate.id)
      && (candidate.modifiable
        || candidate.parentId === 'all'
        || candidate.id === category?.parentId),
  )
  const childCategoryCount = Math.max(0, unavailableIds.size - 1)
  const bookmarkCount = bookmarks.filter(bookmark =>
    unavailableIds.has(bookmark.categoryId),
  ).length

  const save = async () => {
    if (!category)
      return
    if (!name.trim()) {
      dispatch({ patch: { error: t('enterFolderName') }, type: 'patch' })
      return
    }

    dispatch({ patch: { error: '', saving: true }, type: 'patch' })
    try {
      await updateCategory(category.id, {
        name,
        emoji,
        parentId,
      })
      onOpenChange(false)
    }
    catch {
      dispatch({ patch: { error: t('categoryOperationFailed') }, type: 'patch' })
    }
    finally {
      dispatch({ patch: { saving: false }, type: 'patch' })
    }
  }

  const remove = async () => {
    if (!category)
      return
    dispatch({ patch: { error: '', saving: true }, type: 'patch' })
    try {
      await removeCategory(category.id)
      onOpenChange(false)
    }
    catch {
      dispatch({
        patch: { error: t('categoryOperationFailed'), saving: false },
        type: 'patch',
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving)
          onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {confirmingDelete ? t('deleteFolder') : t('editFolder')}
          </DialogTitle>
          <DialogDescription>
            {confirmingDelete
              ? t('deleteFolderDescription')
              : t('editFolderDescription')}
          </DialogDescription>
        </DialogHeader>

        {confirmingDelete
          ? (
              <div className="rounded-md border border-destructive/35 bg-destructive/5 p-4">
                <p className="text-sm font-semibold">
                  {t('deleteNamedFolderTitle', { name: category?.name ?? '' })}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {t('deleteFolderImpact', {
                    bookmarks: bookmarkCount,
                    folders: childCategoryCount,
                  })}
                </p>
              </div>
            )
          : (
              <div className="grid gap-4">
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor="category-name" className="text-sm font-medium">
                      {t('name')}
                    </label>
                    <Input
                      id="category-name"
                      value={name}
                      onChange={event => dispatch({ patch: { name: event.target.value }, type: 'patch' })}
                      disabled={saving}
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="category-emoji" className="text-sm font-medium">
                      {t('icon')}
                    </label>
                    <Input
                      id="category-emoji"
                      value={emoji}
                      onChange={event => dispatch({ patch: { emoji: event.target.value }, type: 'patch' })}
                      disabled={saving}
                      placeholder={DEFAULT_CATEGORY_EMOJI}
                      className="text-center text-lg"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="category-parent" className="text-sm font-medium">
                    {t('parentFolder')}
                  </label>
                  <select
                    id="category-parent"
                    value={parentId}
                    onChange={event => dispatch({ patch: { parentId: event.target.value }, type: 'patch' })}
                    disabled={saving}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {parentOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.emoji}
                        {' '}
                        {getCategoryPath(option, categoryById, categoryName)}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t('folderEmojiHint')}
                </p>
              </div>
            )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {confirmingDelete
          ? (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => dispatch({ patch: { confirmingDelete: false }, type: 'patch' })}
                  disabled={saving}
                >
                  {t('back')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void remove()}
                  disabled={saving}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {saving ? t('deleting') : t('confirmDelete')}
                </Button>
              </DialogFooter>
            )
          : (
              <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => dispatch({ patch: { confirmingDelete: true }, type: 'patch' })}
                  disabled={saving}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('deleteFolder')}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !parentId}
                  >
                    <FolderPen className="mr-2 h-4 w-4" />
                    {saving ? t('savingChanges') : t('save')}
                  </Button>
                </div>
              </DialogFooter>
            )}
      </DialogContent>
    </Dialog>
  )
}
