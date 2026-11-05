import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import de from '../locales/de.json'
import en from '../locales/en.json'

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, de: { translation: de } },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'gstlst.language',
    },
  })

function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language
}

i18n.on('languageChanged', syncDocumentLanguage)
if (i18n.resolvedLanguage) syncDocumentLanguage(i18n.resolvedLanguage)

export default i18n
