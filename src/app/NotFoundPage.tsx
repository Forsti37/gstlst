import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PlaceholderPage } from './PlaceholderPage'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <PlaceholderPage title={t('pages.notFound.title')} body={t('pages.notFound.body')}>
      <Link to="/" className="mt-6 inline-flex min-h-touch items-center rounded-lg bg-surface-2 px-4 font-semibold">
        {t('pages.notFound.back')}
      </Link>
    </PlaceholderPage>
  )
}
