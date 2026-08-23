import type { Category } from '~/lib/types'
import {
  CheckCircle2,
  ExternalLink,
  FolderInput,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { useI18n } from '~/lib/use-i18n'

interface BulkActionBarProps {
  selectedCount: number
  visibleCount: number
  allVisibleSelected: boolean
  categories: Category[]
  destinationId: string
  busy: boolean
  message: string
  onCancel: () => void
  onToggleAll: () => void
  onDestinationChange: (id: string) => void
  onMove: () => void
  onOpen: () => void
  onSync: () => void
  onDelete: () => void
  onOrganize?: () => void
}

export function BulkActionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  categories,
  destinationId,
  busy,
  message,
  onCancel,
  onToggleAll,
  onDestinationChange,
  onMove,
  onOpen,
  onSync,
  onDelete,
  onOrganize,
}: BulkActionBarProps) {
  const { categoryName, t } = useI18n()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [openManyOpen, setOpenManyOpen] = useState(false)

  const actionDisabled = busy || selectedCount === 0
  return (
    <div className="surface-panel mb-4 flex min-h-12 flex-wrap items-center gap-2 px-3 py-2.5">
      <label className="flex h-9 items-center gap-2 px-1 text-sm font-medium">
        <Checkbox
          checked={allVisibleSelected && visibleCount > 0}
          onCheckedChange={onToggleAll}
          disabled={busy || visibleCount === 0}
        />
        {t('bulkSelectedCount', { count: selectedCount })}
      </label>

      <select
        value={destinationId}
        onChange={event => onDestinationChange(event.target.value)}
        disabled={busy}
        aria-label={t('bulkMoveTargetFolder')}
        className="h-9 min-w-36 rounded-lg border border-input bg-card px-2.5 text-sm shadow-sm disabled:opacity-50"
      >
        <option value="" disabled>
          {t('chooseTargetFolder')}
        </option>
        {categories.map(category => (
          <option key={category.id} value={category.id}>
            {category.emoji}
            {' '}
            {categoryName(category)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onMove}
        disabled={actionDisabled || !destinationId}
      >
        <FolderInput data-icon="inline-start" />
        {t('move')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (selectedCount >= 10)
            setOpenManyOpen(true)
          else onOpen()
        }}
        disabled={actionDisabled}
      >
        <ExternalLink data-icon="inline-start" />
        {t('open')}
      </Button>
      {onOrganize
        ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOrganize}
              disabled={actionDisabled}
            >
              <CheckCircle2 data-icon="inline-start" />
              {t('finishOrganizing')}
            </Button>
          )
        : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setDeleteOpen(true)}
        disabled={actionDisabled}
      >
        <Trash2 data-icon="inline-start" />
        {t('delete')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={actionDisabled}
          >
            <MoreHorizontal data-icon="inline-start" />
            {t('more')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSync}>
              <RefreshCw />
              {t('completeWebsiteDescriptions')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-3">
        {message
          ? (
              <span className="text-sm text-muted-foreground">{message}</span>
            )
          : null}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          title={t('exitBulkManagement')}
          aria-label={t('exitBulkManagement')}
          className="icon-button"
        >
          <X className="size-4" />
        </button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              {t('deleteBookmarkCountTitle', { count: selectedCount })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t('bulkDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteOpen(false)
                onDelete()
              }}
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={openManyOpen} onOpenChange={setOpenManyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              {t('openBookmarkCountTitle', { count: selectedCount })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t('openManyDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpenManyOpen(false)
                onOpen()
              }}
            >
              {t('continueOpening')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
