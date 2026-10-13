import type { HeaderWidgetSettings, WeatherLocation } from './types'

export const WEATHER_ORIGINS = ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*']
export const WEATHER_CACHE_TTL_MS = 15 * 60_000
export const DEFAULT_HEADER_WIDGET: HeaderWidgetSettings = {
  clockEnabled: true,
  weatherEnabled: true,
  showDate: true,
  hour12: false,
  temperatureUnit: 'celsius',
  location: null,
  weatherBackground: true,
}

export function normalizeHeaderWidget(value?: Partial<HeaderWidgetSettings>): HeaderWidgetSettings {
  const location = value?.location
  return {
    clockEnabled: value?.clockEnabled !== false,
    weatherEnabled: value?.weatherEnabled !== false,
    showDate: value?.showDate !== false,
    hour12: value?.hour12 === true,
    temperatureUnit: value?.temperatureUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    location: location && typeof location.name === 'string' && location.name.trim()
      && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
      && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
      ? { name: location.name.trim().slice(0, 100), latitude: location.latitude, longitude: location.longitude }
      : null,
    weatherBackground: value?.weatherBackground !== false,
  }
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) })
  if (!response.ok)
    throw new Error('weather_request_failed')
  return response.json()
}

export async function searchWeatherCities(query: string, language: string): Promise<WeatherLocation[]> {
  const params = new URLSearchParams({ name: query.trim(), count: '6', language: language.startsWith('zh') ? 'zh' : language, format: 'json' })
  const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  return (Array.isArray(data.results) ? data.results : []).flatMap((item: Record<string, unknown>) => {
    const location = normalizeHeaderWidget({ location: {
      name: [item.name, item.admin1, item.country].filter(Boolean).join(' · '),
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    } }).location
    return location ? [location] : []
  })
}

export interface WeatherReading {
  temperature: number
  code: number
  isDay: boolean
  fetchedAt: number
}

export async function loadWeather(location: WeatherLocation, unit: HeaderWidgetSettings['temperatureUnit'], signal: AbortSignal): Promise<WeatherReading> {
  const key = `yunji-weather:${location.latitude}:${location.longitude}:${unit}`
  const cached = (await chrome.storage.local.get(key))[key] as WeatherReading | undefined
  if (cached && Number.isFinite(cached.temperature) && Number.isFinite(cached.code)
    && Date.now() - cached.fetchedAt >= 0 && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS) {
    return cached
  }
  if (!await chrome.permissions.contains({ origins: WEATHER_ORIGINS }))
    throw new Error('weather_permission_required')
  const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,weather_code,is_day', temperature_unit: unit })
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`, signal)
  if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code))
    throw new Error('weather_invalid_response')
  const reading = { temperature: data.current.temperature_2m, code: data.current.weather_code, isDay: data.current.is_day === 1, fetchedAt: Date.now() }
  await chrome.storage.local.set({ [key]: reading })
  return reading
}

export function weatherKind(code: number) {
  if (code === 0)
    return 'clear'
  if (code <= 3)
    return 'cloudy'
  if (code === 45 || code === 48)
    return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return 'snow'
  if (code >= 95)
    return 'storm'
  return 'rain'
}

export type WeatherScene = 'clear-day' | 'clear-night' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export function weatherScene(reading: Pick<WeatherReading, 'code' | 'isDay'>): WeatherScene {
  const kind = weatherKind(reading.code)
  if (kind === 'clear')
    return reading.isDay ? 'clear-day' : 'clear-night'
  return kind
}
