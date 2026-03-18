import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from '@/shared/locales/ko/common.json';
import enCommon from '@/shared/locales/en/common.json';
import laCommon from '@/shared/locales/la/common.json';
import koDashboard from '@/shared/locales/ko/dashboard.json';
import enDashboard from '@/shared/locales/en/dashboard.json';
import laDashboard from '@/shared/locales/la/dashboard.json';
import koRegionOverview from '@/shared/locales/ko/region-overview.json';
import enRegionOverview from '@/shared/locales/en/region-overview.json';
import laRegionOverview from '@/shared/locales/la/region-overview.json';
import koMonitoring from '@/shared/locales/ko/monitoring.json';
import enMonitoring from '@/shared/locales/en/monitoring.json';
import laMonitoring from '@/shared/locales/la/monitoring.json';

const SUPPORTED_LANGUAGES = ['ko', 'en', 'la'] as const;
const LANGUAGE_STORAGE_KEY = 'language';
const DEFAULT_NAMESPACE = 'common';
const FORMAT_LOCALE_BY_LANGUAGE = {
  ko: ['ko-KR'],
  en: ['en-US'],
  la: ['la', 'en-US'],
} as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  ko: {
    common: koCommon,
    dashboard: koDashboard,
    'region-overview': koRegionOverview,
    monitoring: koMonitoring,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    'region-overview': enRegionOverview,
    monitoring: enMonitoring,
  },
  la: {
    common: laCommon,
    dashboard: laDashboard,
    'region-overview': laRegionOverview,
    monitoring: laMonitoring,
  },
} as const;

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

  const stored = getSupportedLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
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

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'ko',
  defaultNS: DEFAULT_NAMESPACE,
  ns: ['common', 'dashboard', 'region-overview', 'monitoring'],
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

export { SUPPORTED_LANGUAGES, getFormatLocale, i18n };
export type { SupportedLanguage };
