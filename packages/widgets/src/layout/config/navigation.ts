import {
  LayoutDashboard,
  Box,
  List,
  History,
  MapPin,
  SquarePen,
} from 'lucide-react';
import { i18n } from '@crane/core/config/i18n';
import type { NavGroup } from '@crane/core/types/navigation';

const defaultSystemGroup: NavGroup = {
  title: '',
  items: [],
};

function getOverviewGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.overview'),
    items: [
      {
        label: i18n.t('common:nav.dashboard'),
        path: '/',
        icon: LayoutDashboard,
      },
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
          label: i18n.t('common:nav.threeViewerEdit'),
          path: `${base}/3d-viewer-edit`,
          icon: SquarePen,
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
  '/indoor-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    const base = `/indoor-work/${regionId}`;
    return {
      title: i18n.t('common:nav.indoorWork'),
      items: [
        {
          label: i18n.t('common:nav.realTimeMonitoring'),
          path: `${base}/3d-monitoring`,
          icon: Box,
        },
        {
          label: i18n.t('common:nav.threeViewerEdit'),
          path: `${base}/3d-viewer-edit`,
          icon: SquarePen,
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

export const navigationConfig: NavGroup[] = [
  getOverviewGroup(),
  defaultSystemGroup,
];
