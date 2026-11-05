import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../app/PlaceholderPage'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  return (
    <PlaceholderPage title={t('nav.profile')} body={t('pages.profile.body')}>
      <fieldset className="mt-8">
        <legend className="mb-2 text-sm text-text-secondary">{t('language.label')}</legend>
        <div className="flex gap-2">
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={i18n.resolvedLanguage === language}
              onClick={() => void i18n.changeLanguage(language)}
              className="min-h-touch rounded-lg bg-surface-2 px-4 font-medium text-text-secondary aria-pressed:bg-text-primary aria-pressed:text-bg"
            >
              {t(`language.${language}`)}
            </button>
          ))}
        </div>
      </fieldset>
    </PlaceholderPage>
  )
}
