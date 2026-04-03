import { initI18n } from '@crane/core/config/i18n';

import koCommon from './locales/ko/common.json';
import enCommon from './locales/en/common.json';
import laCommon from './locales/la/common.json';
import koDashboard from './locales/ko/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import laDashboard from './locales/la/dashboard.json';
import koRegionOverview from './locales/ko/region-overview.json';
import enRegionOverview from './locales/en/region-overview.json';
import laRegionOverview from './locales/la/region-overview.json';
import koMonitoring from './locales/ko/monitoring.json';
import enMonitoring from './locales/en/monitoring.json';
import laMonitoring from './locales/la/monitoring.json';

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
};

initI18n(resources, ['common', 'dashboard', 'region-overview', 'monitoring']);
