import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../app/PlaceholderPage'

export function InboxPage() {
  const { t } = useTranslation()
  return <PlaceholderPage title={t('nav.inbox')} body={t('pages.inbox.body')} />
}
