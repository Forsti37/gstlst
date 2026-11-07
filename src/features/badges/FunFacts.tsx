import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFunFacts, type FunFact } from './api'

// Rare and personal first. A big night has many "first time seen" facts.
const ORDER = [
  'event_milestone', 'record_sets', 'series_streak', 'duo_complete', 'first_country', 'first_city', 'first_venue',
  'first_of_year', 'first_subgenre', 'artist_best_rating', 'first_of_friends', 'artist_gap', 'artist_same_weekend',
  'artist_same_month', 'artist_seen',
]

export const sortFunFacts = (facts: FunFact[]) => [...facts].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))

export function useFunFactText() {
  const { t } = useTranslation()
  return (fact: FunFact) =>
    fact.kind === 'artist_seen' && Number(fact.payload.n) === 1
      ? t('funFacts.artist_first', fact.payload)
      : t(`funFacts.${fact.kind}`, { ...fact.payload, defaultValue: '' })
}

/** Visible only to the owner, which the database enforces. Renders nothing without facts. */
export function FunFacts({ checkinId, limit }: { checkinId: string; limit?: number }) {
  const { t } = useTranslation()
  const facts = useFunFacts(checkinId)
  const text = useFunFactText()
  if (!facts.data?.length) return null
  return (
    <section className="mt-6 text-left">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-secondary uppercase">{t('funFacts.title')}</h2>
      <ul className="space-y-1">
        {sortFunFacts(facts.data).slice(0, limit).map((fact) => (
          <li key={fact.id} className="flex items-start gap-2 text-sm">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-text-secondary" />
            <span>{text(fact)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
