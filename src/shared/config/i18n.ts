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

const LANGUAGE_STORAGE_KEY = 'language';
const DEFAULT_NAMESPACE = 'common';

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

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'ko';

  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'ko' || stored === 'en' || stored === 'la') {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
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

export { i18n };
