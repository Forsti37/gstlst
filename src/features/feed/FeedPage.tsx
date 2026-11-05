import { useTranslation } from 'react-i18next'

export function FeedPage() {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-6">
      <h1 className="brand-offset font-display text-5xl tracking-wide">GSTLST</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('brand.tagline')}</p>
      <p className="mt-8 text-text-secondary">{t('pages.feed.body')}</p>
    </section>
  )
}
