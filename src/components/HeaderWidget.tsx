import type { WeatherReading } from '~/lib/weather'
import * as Popover from '@radix-ui/react-popover'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, MapPin, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HeaderWidgetSettingsPanel } from '~/components/settings/HeaderWidgetSettingsPanel'
import { weatherMessages } from '~/lib/i18n-weather'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { loadWeather, WEATHER_CACHE_TTL_MS, weatherKind } from '~/lib/weather'

const weatherIcons = { clear: Sun, cloudy: Cloud, fog: CloudFog, rain: CloudRain, snow: CloudSnow, storm: CloudLightning }

export function HeaderWidget() {
  const settings = useNavStore(state => state.settings.headerWidget)
  const { language, languageTag } = useI18n()
  const messages = weatherMessages(language)
  const [now, setNow] = useState(() => new Date())
  const weatherKey = `${settings.location?.latitude}:${settings.location?.longitude}:${settings.temperatureUnit}`
  const [weather, setWeather] = useState<{ key: string, reading: WeatherReading | null, failed: boolean } | null>(null)
  const reading = weather?.key === weatherKey ? weather.reading : null
  const failed = weather?.key === weatherKey && weather.failed
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!settings.clockEnabled)
      return
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [settings.clockEnabled])

  useEffect(() => {
    if (!settings.weatherEnabled || !settings.location)
      return
    const controller = new AbortController()
    const location = settings.location
    let pending = false
    let timer: number | undefined
    const update = async () => {
      if (pending || document.hidden)
        return
      window.clearTimeout(timer)
      pending = true
      let refreshDelay = WEATHER_CACHE_TTL_MS
      try {
        const next = await loadWeather(location, settings.temperatureUnit, controller.signal)
        if (!controller.signal.aborted) {
          setWeather({ key: weatherKey, reading: next, failed: false })
          refreshDelay = Math.max(1000, next.fetchedAt + WEATHER_CACHE_TTL_MS - Date.now() + 1)
        }
      }
      catch {
        if (!controller.signal.aborted)
          setWeather({ key: weatherKey, reading: null, failed: true })
      }
      finally {
        pending = false
        if (!controller.signal.aborted)
          timer = window.setTimeout(() => void update(), refreshDelay)
      }
    }
    void update()
    document.addEventListener('visibilitychange', update)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [settings.weatherEnabled, settings.location, settings.temperatureUnit, retry, weatherKey])

  if (!settings.clockEnabled && !settings.weatherEnabled)
    return null
  const kind = reading ? weatherKind(reading.code) : 'cloudy'
  const Icon = reading && kind === 'clear' && !reading.isDay ? Moon : weatherIcons[kind]
  const city = settings.location?.name.split(' · ')[0]
  const weatherLabel = !city ? messages.choose : failed ? messages.error : !reading ? messages.loading : `${city} · ${messages[kind]} · ${Math.round(reading.temperature)}°${settings.temperatureUnit === 'celsius' ? 'C' : 'F'}`
  const timeLabel = now.toLocaleTimeString(languageTag, { hour: '2-digit', minute: '2-digit', hour12: settings.hour12 })
  const dateLabel = now.toLocaleDateString(languageTag, { month: 'short', day: 'numeric', weekday: 'short' })
  const accessibleLabel = [messages.title, settings.clockEnabled && timeLabel, settings.clockEnabled && settings.showDate && dateLabel, settings.weatherEnabled && weatherLabel].filter(Boolean).join(' · ')

  return (
    <Popover.Root onOpenChange={(open) => {
      if (open && failed)
        setRetry(value => value + 1)
    }}
    >
      <Popover.Trigger asChild>
        <button type="button" aria-label={accessibleLabel} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:mr-1 sm:gap-3 sm:px-2" data-testid="header-widget">
          {settings.clockEnabled && (
            <span className="flex shrink-0 flex-col">
              <time className="whitespace-nowrap font-mono text-[15px] font-medium leading-6 tracking-[-0.04em] tabular-nums sm:text-lg" dateTime={now.toISOString()}>
                {timeLabel}
              </time>
              {settings.showDate && <span className="hidden text-[10px] leading-4 text-muted-foreground sm:block">{dateLabel}</span>}
            </span>
          )}
          {settings.weatherEnabled && (
            <span title={weatherLabel} aria-label={weatherLabel} className={`flex items-center gap-2 ${settings.clockEnabled ? 'border-l border-border/70 pl-2 sm:pl-3' : ''}`}>
              {!city ? <MapPin className="size-4 text-muted-foreground" /> : <Icon className="size-5 shrink-0" strokeWidth={1.5} />}
              <span className="hidden flex-col sm:flex">
                <span className="text-sm font-medium tabular-nums">{!city ? messages.choose : failed ? '—' : reading ? `${Math.round(reading.temperature)}°${settings.temperatureUnit === 'celsius' ? 'C' : 'F'}` : '…'}</span>
                {city && <span className="max-w-20 truncate text-[10px] leading-4 text-muted-foreground">{city}</span>}
              </span>
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={12} aria-label={messages.title} className="z-50 max-h-[80vh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <HeaderWidgetSettingsPanel />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
