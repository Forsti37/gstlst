import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ErrorText, Section } from '../../app/ui'
import { useMember } from '../auth/auth'
import { Chip } from '../checkin/components'
import { CATEGORIES, levelName, nextThreshold, useBadges, type Badge } from './api'
import { BadgeIcon } from './BadgeIcon'

function BadgeRow({ badge, own }: { badge: Badge; own: boolean }) {
  const { t, i18n } = useTranslation()
  const next = nextThreshold(badge)
  const description = i18n.resolvedLanguage === 'de' && badge.description_de ? badge.description_de : badge.description
  const previous = badge.levels[badge.level - 1] ?? 0
  const share = next == null || badge.value == null ? 1 : Math.min(1, Math.max(0, (badge.value - previous) / (next - previous)))
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-1 p-3">
      <BadgeIcon category={badge.category} level={badge.level} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{badge.level > 0 ? levelName(badge, badge.level) : badge.name}</p>
        <p className="text-sm text-text-secondary">{description}</p>
        {badge.level > 0 && badge.levels.length > 1 && (
          <p className="text-xs text-text-secondary">{t('badges.level', { level: badge.level, count: badge.levels.length })}</p>
        )}
        {own && badge.value != null && (
          <>
            <p className="mt-1 text-xs text-text-secondary tabular-nums">
              {next == null ? t('badges.maxed') : t('badges.progress', { value: badge.value, next })}
            </p>
            {next != null && (
              <span aria-hidden className="mt-1 block h-1 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-red" style={{ width: `${Math.max(2, share * 100)}%` }} />
              </span>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/** The latest badges on someone's profile. Renders nothing without any. */
export function BadgeStrip({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const badges = useBadges(userId)
  const earned = (badges.data ?? []).filter((badge) => badge.level > 0)
  if (earned.length === 0) return null
  const latest = [...earned].sort((a, b) => (b.awarded_at ?? '').localeCompare(a.awarded_at ?? '')).slice(0, 5)
  return (
    <Section title={t('badges.title')}>
      <Link to={`/badges/${userId}`} aria-label={t('badges.showAll', { count: earned.length })} className="flex min-h-touch items-center gap-2 overflow-x-auto">
        {latest.map((badge) => <BadgeIcon key={badge.id} category={badge.category} level={badge.level} size={48} />)}
        <span className="ml-auto shrink-0 text-sm text-text-secondary">{t('badges.showAll', { count: earned.length })}</span>
      </Link>
    </Section>
  )
}

export function BadgesPage() {
  const { t } = useTranslation()
  const { userId } = useParams()
  const me = useMember()
  const target = userId ?? me.id
  const own = target === me.id
  const badges = useBadges(target)
  const [category, setCategory] = useState<string | null>(null)

  const visible = useMemo(() => {
    const all = (badges.data ?? []).filter((badge) => !category || badge.category === category)
    // Someone else's page shows what they earned. Your own also shows how close you are.
    const shown = own ? all : all.filter((badge) => badge.level > 0)
    const closeness = (badge: Badge) => {
      const next = nextThreshold(badge)
      return next == null || badge.value == null ? 0 : badge.value / next
    }
    return [...shown].sort((a, b) => Number(b.level > 0) - Number(a.level > 0) || closeness(b) - closeness(a) || a.name.localeCompare(b.name))
  }, [badges.data, category, own])
  const earned = (badges.data ?? []).filter((badge) => badge.level > 0).length

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{t('badges.title')}</h1>
      {badges.data && badges.data.length > 0 && <p className="mt-1 text-text-secondary">{t('badges.summary', { earned, total: badges.data.length })}</p>}
      {badges.isError && <ErrorText>{t('badges.loadFailed')}</ErrorText>}
      {badges.isPending && <p className="mt-6 text-text-secondary">{t('common.loading')}</p>}
      {badges.data?.length === 0 && <p className="mt-6 text-text-secondary">{t('badges.hidden')}</p>}
      {badges.data && badges.data.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          <Chip selected={category === null} onClick={() => setCategory(null)}>{t('badges.all')}</Chip>
          {CATEGORIES.map((key) => (
            <Chip key={key} selected={category === key} onClick={() => setCategory(key)}><span className="whitespace-nowrap">{t(`badges.categories.${key}`)}</span></Chip>
          ))}
        </div>
      )}
      <ul className="mt-3 space-y-2">
        {visible.map((badge) => <BadgeRow key={badge.id} badge={badge} own={own} />)}
      </ul>
    </div>
  )
}
