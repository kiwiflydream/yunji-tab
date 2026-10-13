import { useWeatherScene } from '~/lib/weather-scene'

const sunRays = Array.from({ length: 12 }, (_, index) => index * 30)

function Cloud() {
  return (
    <svg viewBox="0 0 240 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 78h196c12 0 20-8 18-18-2-11-14-15-24-10 2-16-12-28-28-24-6-20-34-26-48-10-12-12-34-8-40 8-14-6-30 2-30 18-12 0-22 8-22 18 0 10 8 18 18 18z" />
      <path d="M62 60c0-9 11-12 16-6 4 5-1 12-7 10" />
      <path d="M118 52c0-11 14-15 20-7 5 7-1 15-9 13" />
      <path d="M178 60c0-8 10-10 14-5 3 4-1 10-6 8" />
    </svg>
  )
}

// Decorative layer behind the centered hero; every scene is CSS-only and stops under reduced motion.
export function WeatherBackdrop() {
  const scene = useWeatherScene(state => state.scene)
  if (!scene)
    return null

  return (
    <div key={scene} className="weather-backdrop" data-weather-scene={scene} aria-hidden="true">
      <div className="wx-wash" />
      {scene === 'clear-day'
        ? (
            <svg className="wx-sun" viewBox="0 0 150 150" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
              <circle cx="75" cy="75" r="28" />
              {sunRays.map(angle => <line key={angle} x1="75" y1="10" x2="75" y2="28" transform={`rotate(${angle} 75 75)`} />)}
            </svg>
          )
        : null}
      {scene === 'clear-night'
        ? (
            <>
              <svg className="wx-moon" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round">
                <path d="M52 10a30 30 0 1 0 18 46A26 26 0 0 1 52 10z" />
              </svg>
              {[1, 2, 3, 4, 5].map(index => <span key={index} className={`wx-star wx-star-${index}`} />)}
            </>
          )
        : null}
      {scene === 'cloudy' || scene === 'storm'
        ? [1, 2].map(index => <div key={index} className={`wx-cloud wx-cloud-${index}`}><Cloud /></div>)
        : null}
      {scene === 'fog'
        ? [1, 2, 3].map(index => <div key={index} className={`wx-band wx-band-${index}`} />)
        : null}
      {scene === 'rain' || scene === 'storm'
        ? (
            <>
              <div className="wx-rain" />
              <div className="wx-rain wx-rain-mid" />
              <div className="wx-rain wx-rain-far" />
            </>
          )
        : null}
      {scene === 'snow'
        ? (
            <>
              <div className="wx-snow" />
              <div className="wx-snow wx-snow-mid" />
              <div className="wx-snow wx-snow-far" />
            </>
          )
        : null}
      {scene === 'storm' ? <div className="wx-flash" /> : null}
    </div>
  )
}
