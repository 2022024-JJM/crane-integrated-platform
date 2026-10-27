import { initI18n } from '@crane/core/config/i18n';

import koCommon from './locales/ko/common.json';
import enCommon from './locales/en/common.json';
import laCommon from './locales/la/common.json';
import koMonitoring from './locales/ko/monitoring.json';
import enMonitoring from './locales/en/monitoring.json';
import laMonitoring from './locales/la/monitoring.json';
import koMonitoringOverview from './locales/ko/monitoring-overview.json';
import enMonitoringOverview from './locales/en/monitoring-overview.json';
import laMonitoringOverview from './locales/la/monitoring-overview.json';
import koAssetManagement from './locales/ko/asset-management.json';
import enAssetManagement from './locales/en/asset-management.json';
import laAssetManagement from './locales/la/asset-management.json';
import koInspection from './locales/ko/inspection.json';
import enInspection from './locales/en/inspection.json';
import laInspection from './locales/la/inspection.json';
import koMaintenance from './locales/ko/maintenance.json';
import enMaintenance from './locales/en/maintenance.json';
import laMaintenance from './locales/la/maintenance.json';
import koInventory from './locales/ko/inventory.json';
import enInventory from './locales/en/inventory.json';
import laInventory from './locales/la/inventory.json';
import koCompliance from './locales/ko/compliance.json';
import enCompliance from './locales/en/compliance.json';
import laCompliance from './locales/la/compliance.json';
import koPhillyDashboard from './locales/ko/philly-dashboard.json';
import enPhillyDashboard from './locales/en/philly-dashboard.json';
import laPhillyDashboard from './locales/la/philly-dashboard.json';
import koTicket from './locales/ko/ticket.json';
import enTicket from './locales/en/ticket.json';
import laTicket from './locales/la/ticket.json';
import koCalendar from './locales/ko/calendar.json';
import enCalendar from './locales/en/calendar.json';
import laCalendar from './locales/la/calendar.json';
import koHistory from './locales/ko/history.json';
import enHistory from './locales/en/history.json';
import laHistory from './locales/la/history.json';
import koMro2 from './locales/ko/mro2.json';
import enMro2 from './locales/en/mro2.json';
import laMro2 from './locales/la/mro2.json';
import koAssetLibrary from './locales/ko/asset-library.json';
import enAssetLibrary from './locales/en/asset-library.json';
import laAssetLibrary from './locales/la/asset-library.json';

const resources = {
  ko: {
    common: koCommon,
    monitoring: koMonitoring,
    'monitoring-overview': koMonitoringOverview,
    'asset-management': koAssetManagement,
    inspection: koInspection,
    maintenance: koMaintenance,
    inventory: koInventory,
    compliance: koCompliance,
    'philly-dashboard': koPhillyDashboard,
    ticket: koTicket,
    calendar: koCalendar,
    history: koHistory,
    mro2: koMro2,
    'asset-library': koAssetLibrary,
  },
  en: {
    common: enCommon,
    monitoring: enMonitoring,
    'monitoring-overview': enMonitoringOverview,
    'asset-management': enAssetManagement,
    inspection: enInspection,
    maintenance: enMaintenance,
    inventory: enInventory,
    compliance: enCompliance,
    'philly-dashboard': enPhillyDashboard,
    ticket: enTicket,
    calendar: enCalendar,
    history: enHistory,
    mro2: enMro2,
    'asset-library': enAssetLibrary,
  },
  la: {
    common: laCommon,
    monitoring: laMonitoring,
    'monitoring-overview': laMonitoringOverview,
    'asset-management': laAssetManagement,
    inspection: laInspection,
    maintenance: laMaintenance,
    inventory: laInventory,
    compliance: laCompliance,
    'philly-dashboard': laPhillyDashboard,
    ticket: laTicket,
    calendar: laCalendar,
    history: laHistory,
    mro2: laMro2,
    'asset-library': laAssetLibrary,
  },
};

initI18n(resources, [
  'common',
  'monitoring',
  'monitoring-overview',
  'asset-management',
  'inspection',
  'maintenance',
  'inventory',
  'compliance',
  'philly-dashboard',
  'ticket',
  'calendar',
  'history',
  'mro2',
  'asset-library',
]);
