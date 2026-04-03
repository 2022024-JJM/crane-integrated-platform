import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

const SUPPORTED_LANGUAGES = ['ko', 'en', 'la'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const DEFAULT_NAMESPACE = 'common';
const FORMAT_LOCALE_BY_LANGUAGE = {
  ko: ['ko-KR'],
  en: ['en-US'],
  la: ['la', 'en-US'],
} as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type I18nResources = Resource;

function isSupportedLanguage(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

function getSupportedLanguage(
  language: string | null | undefined,
): SupportedLanguage | null {
  if (!language) {
    return null;
  }

  const normalizedLanguage = language.toLowerCase();
  if (isSupportedLanguage(normalizedLanguage)) {
    return normalizedLanguage;
  }

  const baseLanguage = normalizedLanguage.split('-')[0];
  return isSupportedLanguage(baseLanguage) ? baseLanguage : null;
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'ko';

  const stored = getSupportedLanguage(
    localStorage.getItem(LANGUAGE_STORAGE_KEY),
  );
  if (stored) {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function getFormatLocale(language: string) {
  const supportedLanguage = getSupportedLanguage(language) ?? 'en';
  return (
    Intl.DateTimeFormat.supportedLocalesOf(
      FORMAT_LOCALE_BY_LANGUAGE[supportedLanguage],
    )[0] ?? 'en-US'
  );
}

function initI18n(resources: I18nResources, namespaces: string[] = ['common']) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'ko',
    defaultNS: DEFAULT_NAMESPACE,
    ns: namespaces,
    interpolation: {
      escapeValue: false,
    },
  });

  i18n.on('languageChanged', (language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.language;
  }
}

export { SUPPORTED_LANGUAGES, getFormatLocale, initI18n, i18n };
export type { SupportedLanguage, I18nResources };
