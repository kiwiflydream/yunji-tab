import type { HeaderWidgetSettings, WeatherLocation } from '~/lib/types'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { weatherMessages } from '~/lib/i18n-weather'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { searchWeatherCities, WEATHER_ORIGINS } from '~/lib/weather'

export function HeaderWidgetSettingsPanel() {
  const { language } = useI18n()
  const messages = weatherMessages(language)
  const settings = useNavStore(state => state.settings.headerWidget)
  const setSettings = useNavStore(state => state.setHeaderWidget)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherLocation[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (patch: Partial<HeaderWidgetSettings>) => {
    setSaving(true)
    setError('')
    try {
      await setSettings(patch)
      if (patch.location) {
        setResults([])
        setSearched(false)
        setQuery('')
      }
    }
    catch {
      setError(messages.saveError)
    }
    finally {
      setSaving(false)
    }
  }

  const search = async () => {
    if (busy || query.trim().length < 2)
      return
    setBusy(true)
    setError('')
    setResults([])
    setSearched(false)
    try {
      const allowed = await chrome.permissions.request({ origins: WEATHER_ORIGINS })
      if (!allowed) {
        setError(messages.permission)
        return
      }
      setResults(await searchWeatherCities(query, language))
      setSearched(true)
    }
    catch {
      setError(messages.searchError)
    }
    finally {
      setBusy(false)
    }
  }

  const selectClass = 'h-9 rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/35 p-4" aria-label={messages.title}>
      <h3 className="text-sm font-semibold">{messages.title}</h3>
      <fieldset disabled={saving} className="space-y-3 disabled:opacity-60">
        {([
          ['clockEnabled', messages.clock],
          ['weatherEnabled', messages.weather],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            <span>{label}</span>
            <Switch checked={settings[key]} onCheckedChange={value => void save({ [key]: value })} />
          </label>
        ))}
        {settings.clockEnabled && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{messages.format}</span>
              <select aria-label={messages.format} className={selectClass} value={settings.hour12 ? '12' : '24'} onChange={event => void save({ hour12: event.target.value === '12' })}>
                <option value="24">{messages.hour24}</option>
                <option value="12">{messages.hour12}</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{messages.date}</span>
              <Switch checked={settings.showDate} onCheckedChange={value => void save({ showDate: value })} />
            </label>
          </div>
        )}
        {settings.weatherEnabled && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{messages.unit}</span>
              <select aria-label={messages.unit} className={selectClass} value={settings.temperatureUnit} onChange={event => void save({ temperatureUnit: event.target.value as HeaderWidgetSettings['temperatureUnit'] })}>
                <option value="celsius">°C</option>
                <option value="fahrenheit">°F</option>
              </select>
            </label>
            <p className="text-sm font-medium">{settings.location?.name ?? messages.choose}</p>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void search()
              }}
            >
              <Input
                aria-label={messages.city}
                placeholder={messages.placeholder}
                value={query}
                disabled={busy}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearched(false)
                  setResults([])
                }}
              />
              <Button type="submit" variant="outline" disabled={busy || query.trim().length < 2} aria-label={messages.search}>
                <Search className="size-4" />
              </Button>
            </form>
            {busy && <p role="status" className="text-xs text-muted-foreground">{messages.searching}</p>}
            {searched && results.length === 0 && <p role="status" className="text-xs text-muted-foreground">{messages.empty}</p>}
            {results.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {results.map(location => (
                  <li key={`${location.latitude}:${location.longitude}`}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => void save({ location })}>{location.name}</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {messages.privacy}
              {' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">{messages.source}</a>
            </p>
          </div>
        )}
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
