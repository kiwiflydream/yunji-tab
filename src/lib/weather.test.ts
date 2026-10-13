import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadWeather, normalizeHeaderWidget, searchWeatherCities, weatherKind } from './weather'

afterEach(() => vi.unstubAllGlobals())

describe('weather settings and API', () => {
  it('rejects corrupt coordinates and units', () => {
    expect(normalizeHeaderWidget({ location: { name: 'City', latitude: 91, longitude: 0 }, temperatureUnit: 'kelvin' as never }))
      .toMatchObject({ location: null, temperatureUnit: 'celsius' })
    expect(normalizeHeaderWidget({ location: { name: ' City ', latitude: 0, longitude: 0 } }).location)
      .toEqual({ name: 'City', latitude: 0, longitude: 0 })
  })

  it('maps WMO conditions including freezing fog and snow showers', () => {
    expect([0, 3, 48, 65, 85, 99].map(weatherKind)).toEqual(['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm'])
  })

  it('reuses fresh cached weather without a network request', async () => {
    const reading = { temperature: 21, code: 0, isDay: true, fetchedAt: Date.now() }
    vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => ({ [key]: reading }) } } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await loadWeather({ name: 'City', latitude: 0, longitude: 0 }, 'celsius', new AbortController().signal)).toEqual(reading)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects missing permission without requesting weather', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}) } }, permissions: { contains: async () => false } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(loadWeather({ name: 'City', latitude: 0, longitude: 0 }, 'celsius', new AbortController().signal)).rejects.toThrow('weather_permission_required')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requests the selected unit and rejects invalid weather data', async () => {
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), set: vi.fn() } }, permissions: { contains: async () => true } })
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: { temperature_2m: null, weather_code: 0 } }) })
    vi.stubGlobal('fetch', fetch)
    await expect(loadWeather({ name: 'City', latitude: 0, longitude: 0 }, 'fahrenheit', new AbortController().signal)).rejects.toThrow('weather_invalid_response')
    expect(fetch.mock.calls[0][0]).toContain('temperature_unit=fahrenheit')
  })

  it('keeps valid city results and drops malformed coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { name: 'Shanghai', country: 'China', latitude: 31.2, longitude: 121.4 },
      { name: 'Broken', latitude: 999, longitude: 0 },
    ] }) }))
    expect(await searchWeatherCities('Shanghai', 'en')).toEqual([{ name: 'Shanghai · China', latitude: 31.2, longitude: 121.4 }])
  })
})
