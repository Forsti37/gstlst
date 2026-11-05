import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../app/PlaceholderPage'

export function DiscoverPage() {
  const { t } = useTranslation()
  return <PlaceholderPage title={t('nav.discover')} body={t('pages.discover.body')} />
}
