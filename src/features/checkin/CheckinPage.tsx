import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../app/PlaceholderPage'

export function CheckinPage() {
  const { t } = useTranslation()
  return <PlaceholderPage title={t('nav.checkin')} body={t('pages.checkin.body')} />
}
