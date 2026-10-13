import type { WeatherScene } from './weather'
import { create } from 'zustand'

// The hero widget already loads weather; it publishes the current scene here so the backdrop never fetches on its own.
export const useWeatherScene = create<{ scene: WeatherScene | null, setScene: (scene: WeatherScene | null) => void }>(set => ({
  scene: null,
  setScene: scene => set({ scene }),
}))
