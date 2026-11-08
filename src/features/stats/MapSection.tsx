import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../app/ui'
import type { Tone } from './charts'
import type { MapPoint } from './VenueMap'

const VenueMap = lazy(() => import('./VenueMap'))

/** The map only loads on request: it is large, and its tiles come from OpenFreeMap. */
export function MapSection({ points, tone, initiallyOpen = false }: { points: MapPoint[]; tone: Tone; initiallyOpen?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(initiallyOpen)
  if (points.length === 0) return null
  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>{t('stats.showMap')}</Button>
        <p className="mt-1 text-xs text-text-secondary">{t('stats.mapHint')}</p>
      </div>
    )
  }
  return (
    <Suspense fallback={<p className="text-text-secondary">{t('common.loading')}</p>}>
      <VenueMap points={points} tone={tone} />
    </Suspense>
  )
}
