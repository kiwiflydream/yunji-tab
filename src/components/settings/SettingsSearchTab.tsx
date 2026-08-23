import { Trash2 } from 'lucide-react'
import { SearchEngineSettings } from '~/components/SearchEngineSettings'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function SettingsSearchTab() {
  const { t } = useI18n()
  const savedSearches = useNavStore(state => state.settings.savedSearches)
  const removeSavedSearch = useNavStore(state => state.removeSavedSearch)

  return (
    <>
      {savedSearches.length > 0
        ? (
            <section className="rounded-xl border border-border bg-muted/35 p-4">
              <h3 className="text-sm font-semibold">{t('savedFiltersTitle')}</h3>
              <div className="mt-3 grid gap-2">
                {savedSearches.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md bg-background px-3 py-2 ring-1 ring-border"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-sm"
                      title={item.query}
                    >
                      {item.name}
                    </span>
                    <button
                      type="button"
                      title={t('deleteSavedFilter')}
                      aria-label={t('deleteNamedFilter', { name: item.name })}
                      onClick={() => void removeSavedSearch(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        : null}
      <SearchEngineSettings />
    </>
  )
}
