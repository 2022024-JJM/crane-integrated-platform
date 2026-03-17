import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from '@/shared/locales/ko/common.json';
import enCommon from '@/shared/locales/en/common.json';
import koDashboard from '@/shared/locales/ko/dashboard.json';
import enDashboard from '@/shared/locales/en/dashboard.json';
import koRegionOverview from '@/shared/locales/ko/region-overview.json';
import enRegionOverview from '@/shared/locales/en/region-overview.json';
import koOutdoorWork from '@/shared/locales/ko/outdoor-work.json';
import enOutdoorWork from '@/shared/locales/en/outdoor-work.json';

const LANGUAGE_STORAGE_KEY = 'language';
const DEFAULT_NAMESPACE = 'common';

const resources = {
  ko: {
    common: koCommon,
    dashboard: koDashboard,
    'region-overview': koRegionOverview,
    'outdoor-work': koOutdoorWork,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    'region-overview': enRegionOverview,
    'outdoor-work': enOutdoorWork,
  },
} as const;

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'ko';

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'ko' || stored === 'en') {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'ko',
  defaultNS: DEFAULT_NAMESPACE,
  ns: ['common', 'dashboard', 'region-overview', 'outdoor-work'],
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

export { i18n };
