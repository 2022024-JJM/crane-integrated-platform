import { LayoutDashboard, Box, List, History, MapPin } from 'lucide-react';
import { i18n } from '@/shared/config/i18n';
import type { NavGroup } from '@/shared/types';

const defaultSystemGroup: NavGroup = {
  title: '',
  items: [],
};

function getOverviewGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.overview'),
    items: [
      { label: i18n.t('common:nav.dashboard'), path: '/', icon: LayoutDashboard },
      {
        label: i18n.t('common:nav.regionOverview'),
        path: '/region-overview',
        icon: MapPin,
      },
    ],
  };
}

const systemGroupOverrides: Record<string, (pathname: string) => NavGroup> = {
  '/outdoor-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    const base = `/outdoor-work/${regionId}`;
    return {
      title: i18n.t('common:nav.outdoorWork'),
      items: [
        {
          label: i18n.t('common:nav.realTimeMonitoring'),
          path: `${base}/3d-monitoring`,
          icon: Box,
        },
        {
          label: i18n.t('common:nav.craneStatus'),
          path: `${base}/crane-status`,
          icon: List,
        },
        {
          label: i18n.t('common:nav.workHistory'),
          path: `${base}/work-history`,
          icon: History,
        },
      ],
    };
  },
};

export function getNavigationConfig(pathname: string): NavGroup[] {
  const matchedKey = Object.keys(systemGroupOverrides).find((prefix) =>
    pathname.startsWith(prefix),
  );
  const systemGroup = matchedKey
    ? systemGroupOverrides[matchedKey](pathname)
    : defaultSystemGroup;
  return [getOverviewGroup(), systemGroup];
}

export const navigationConfig: NavGroup[] = [getOverviewGroup(), defaultSystemGroup];
