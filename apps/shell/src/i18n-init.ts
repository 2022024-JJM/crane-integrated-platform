import { initI18n } from '@crane/core/config/i18n';

import koCommon from './locales/ko/common.json';
import enCommon from './locales/en/common.json';
import laCommon from './locales/la/common.json';
import koDashboard from './locales/ko/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import laDashboard from './locales/la/dashboard.json';
import koMonitoring from './locales/ko/monitoring.json';
import enMonitoring from './locales/en/monitoring.json';
import laMonitoring from './locales/la/monitoring.json';
import koMonitoringOverview from './locales/ko/monitoring-overview.json';
import enMonitoringOverview from './locales/en/monitoring-overview.json';
import laMonitoringOverview from './locales/la/monitoring-overview.json';
import koGoliathCrane from './locales/ko/goliath-crane.json';
import enGoliathCrane from './locales/en/goliath-crane.json';
import laGoliathCrane from './locales/la/goliath-crane.json';
import koCmms from './locales/ko/cmms.json';
import enCmms from './locales/en/cmms.json';
import laCmms from './locales/la/cmms.json';
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

const resources = {
  ko: {
    common: koCommon,
    dashboard: koDashboard,
    monitoring: koMonitoring,
    'monitoring-overview': koMonitoringOverview,
    'goliath-crane': koGoliathCrane,
    cmms: koCmms,
    'asset-management': koAssetManagement,
    inspection: koInspection,
    maintenance: koMaintenance,
    inventory: koInventory,
    compliance: koCompliance,
    'philly-dashboard': koPhillyDashboard,
    ticket: koTicket,
    calendar: koCalendar,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    monitoring: enMonitoring,
    'monitoring-overview': enMonitoringOverview,
    'goliath-crane': enGoliathCrane,
    cmms: enCmms,
    'asset-management': enAssetManagement,
    inspection: enInspection,
    maintenance: enMaintenance,
    inventory: enInventory,
    compliance: enCompliance,
    'philly-dashboard': enPhillyDashboard,
    ticket: enTicket,
    calendar: enCalendar,
  },
  la: {
    common: laCommon,
    dashboard: laDashboard,
    monitoring: laMonitoring,
    'monitoring-overview': laMonitoringOverview,
    'goliath-crane': laGoliathCrane,
    cmms: laCmms,
    'asset-management': laAssetManagement,
    inspection: laInspection,
    maintenance: laMaintenance,
    inventory: laInventory,
    compliance: laCompliance,
    'philly-dashboard': laPhillyDashboard,
    ticket: laTicket,
    calendar: laCalendar,
  },
};

initI18n(resources, [
  'common',
  'dashboard',
  'monitoring',
  'monitoring-overview',
  'goliath-crane',
  'cmms',
  'asset-management',
  'inspection',
  'maintenance',
  'inventory',
  'compliance',
  'philly-dashboard',
  'ticket',
  'calendar',
]);
