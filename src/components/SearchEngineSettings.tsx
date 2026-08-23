import type { SearchEngine } from '~/lib/types'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'

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
import { Input } from '~/components/ui/input'
import { searchEngines } from '~/lib/default-data'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const EMPTY_ENGINE: Omit<SearchEngine, 'id'> = {
  name: '',
  keyword: '',
  url: '',
  emoji: '🔎',
}

export function SearchEngineSettings() {
  const { t } = useI18n()
  const customEngines = useNavStore(
    state => state.settings.customSearchEngines,
  )
  const addEngine = useNavStore(state => state.addCustomSearchEngine)
  const updateEngine = useNavStore(state => state.updateCustomSearchEngine)
  const removeEngine = useNavStore(state => state.removeCustomSearchEngine)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_ENGINE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SearchEngine | null>(null)

  const openCreate = () => {
    setEditingId('new')
    setForm(EMPTY_ENGINE)
    setError('')
  }
  const openEdit = (engine: SearchEngine) => {
    setEditingId(engine.id)
    setForm({
      name: engine.name,
      keyword: engine.keyword,
      url: engine.url,
      emoji: engine.emoji,
    })
    setError('')
  }
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (editingId === 'new')
        await addEngine(form)
      else if (editingId)
        await updateEngine(editingId, form)
      setEditingId(null)
      setForm(EMPTY_ENGINE)
    }
    catch {
      setError(t('saveSearchEngineFailed'))
    }
    finally {
      setSaving(false)
    }
  }
  const remove = async (id: string) => {
    setSaving(true)
    setError('')
    try {
      await removeEngine(id)
    }
    catch {
      setError(t('deleteSearchEngineFailed'))
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-muted/35">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <h3 className="text-balance text-sm font-semibold">{t('searchEngines')}</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openCreate}
          disabled={editingId !== null}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('add')}
        </Button>
      </div>

      <div className="divide-y divide-border border-t border-border">
        {[...searchEngines, ...customEngines].map((engine) => {
          const custom = engine.id.startsWith('custom-')
          return (
            <div
              key={engine.id}
              className="flex min-h-11 items-center gap-2 px-4 py-2"
            >
              <span className="w-6 text-center">{engine.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {engine.name}
              </span>
              <code className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                {engine.keyword}
              </code>
              {custom
                ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(engine)}
                        disabled={editingId !== null}
                        title={t('editNamed', { name: engine.name })}
                        aria-label={t('editNamedSearchEngine', { name: engine.name })}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(engine)}
                        disabled={editingId !== null || saving}
                        title={t('deleteNamed', { name: engine.name })}
                        aria-label={t('deleteNamedSearchEngine', { name: engine.name })}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )
                : null}
            </div>
          )
        })}
      </div>

      {!editingId && error
        ? (
            <p className="border-t border-border px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )
        : null}

      {editingId
        ? (
            <div className="grid gap-3 border-t border-border bg-background/60 p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]">
                <Input
                  value={form.name}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      name: event.target.value,
                    }))}
                  placeholder={t('name')}
                  aria-label={t('searchEngineName')}
                  autoFocus
                  className="col-span-2 sm:col-span-1"
                />
                <Input
                  value={form.keyword}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      keyword: event.target.value,
                    }))}
                  placeholder={t('keyword')}
                  aria-label={t('searchEngineKeyword')}
                />
                <Input
                  value={form.emoji}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      emoji: event.target.value,
                    }))}
                  placeholder={t('icon')}
                  aria-label={t('searchEngineIcon')}
                  className="text-center"
                />
              </div>
              <Input
                value={form.url}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    url: event.target.value,
                  }))}
                placeholder="https://example.com/search?q=%s"
                aria-label={t('searchUrlTemplate')}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          )
        : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen)
            setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              {t('deleteSearchEngineTitle', { name: deleteTarget?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t('deleteSearchEngineDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deleteTarget
                setDeleteTarget(null)
                if (target)
                  void remove(target.id)
              }}
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
