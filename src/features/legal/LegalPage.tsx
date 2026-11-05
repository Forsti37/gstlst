import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

const PAGES = ['privacy', 'terms', 'imprint'] as const
type LegalKey = (typeof PAGES)[number]

/** Reachable without login. The texts are placeholders until someone qualified has reviewed them. */
export function LegalPage() {
  const { t } = useTranslation()
  const { page } = useParams()
  const key = PAGES.find((candidate) => candidate === page) as LegalKey | undefined

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Link to="/" className="inline-flex min-h-touch items-center text-text-secondary">{t('legal.back')}</Link>
      {key ? (
        <>
          <h1 className="font-display mt-2 text-4xl tracking-wide uppercase">{t(`legal.${key}.title`)}</h1>
          <p className="mt-4 rounded-lg bg-surface-1 p-3 text-sm text-text-secondary">{t('legal.placeholder')}</p>
          <p className="mt-6 whitespace-pre-line">{t(`legal.${key}.body`)}</p>
        </>
      ) : (
        <h1 className="font-display mt-2 text-4xl uppercase">{t('pages.notFound.title')}</h1>
      )}
    </main>
  )
}
