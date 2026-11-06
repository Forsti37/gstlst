import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { Tone } from './charts'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  events: number
}

const STYLE = 'https://tiles.openfreemap.org/styles/dark'

/** Loaded on demand, because the library is large and the tiles come from outside the app. */
export default function VenueMap({ points, tone }: { points: MapPoint[]; tone: Tone }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const first = points[0]
    if (!container.current || !first) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [first.lng, first.lat],
        zoom: 11,
        attributionControl: { compact: true },
        // One finger keeps scrolling the page.
        cooperativeGestures: true,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': t('stats.mapGestureDesktop'),
          'CooperativeGesturesHandler.MacHelpText': t('stats.mapGestureDesktop'),
          'CooperativeGesturesHandler.MobileHelpText': t('stats.mapGestureMobile'),
        },
      })
    } catch {
      // No WebGL on this device.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true)
      return
    }
    map.on('load', () => {
      const color = getComputedStyle(document.documentElement).getPropertyValue(tone === 'own' ? '--gst-red' : '--gst-blue').trim()
      map.addSource('venues', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map((point) => ({
            type: 'Feature',
            properties: { id: point.id, events: point.events },
            geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          })),
        },
      })
      map.addLayer({
        id: 'venues',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-color': color,
          'circle-radius': ['interpolate', ['linear'], ['get', 'events'], 1, 6, 20, 14],
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2,
        },
      })
      map.on('click', 'venues', (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined
        if (id) void navigate(`/venues/${id}`)
      })
      if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds()
        points.forEach((point) => bounds.extend([point.lng, point.lat]))
        // No animation, which also respects prefers-reduced-motion.
        map.fitBounds(bounds, { padding: 48, maxZoom: 12, animate: false })
      }
    })
    return () => map.remove()
  }, [points, tone, navigate, t])

  if (failed) return <p className="text-sm text-text-secondary">{t('stats.mapUnavailable')}</p>
  return <div ref={container} data-testid="venue-map" className="h-72 w-full overflow-hidden rounded-lg bg-surface-1" />
}
