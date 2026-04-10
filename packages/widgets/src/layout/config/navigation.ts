import {
  LayoutDashboard,
  Box,
  List,
  History,
  MapPin,
  Play,
  SquarePen,
  Activity,
  ArrowUpDown,
  ArrowLeftRight,
  TrendingUp,
  Settings,
  MonitorCheck,
} from 'lucide-react';
import { i18n } from '@crane/core/config/i18n';
import type { NavGroup } from '@crane/core/types/navigation';
import type { SiteType } from '@crane/core/lib/site-type-context';

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
      {
        label: i18n.t('common:nav.craneDetail'),
        path: '/crane-detail',
        icon: MonitorCheck,
      },
    ],
  };
}

function buildCmmsGroup(craneId: string): NavGroup {
  const base = `/crane-detail/${craneId}`;
  const title = craneId.replace(/_/g, '-');
  return {
    title,
    items: [
      {
        label: 'Overview',
        path: `${base}/overview`,
        icon: LayoutDashboard,
      },
      {
        label: 'Main/Aux Hoist',
        path: `${base}/hoist`,
        icon: ArrowUpDown,
      },
      {
        label: 'Trolley/Travelling',
        path: `${base}/trolley`,
        icon: ArrowLeftRight,
      },
      {
        label: '가동/고장 정보',
        path: `${base}/fault-info`,
        icon: Activity,
      },
      {
        label: '가동/고장 이력',
        path: `${base}/fault-history`,
        icon: History,
      },
      {
        label: 'Trend',
        path: `${base}/trend`,
        icon: TrendingUp,
      },
      {
        label: 'Configuration',
        path: `${base}/configuration`,
        icon: Settings,
      },
    ],
  };
}

function buildWorkGroup(title: string, base: string): NavGroup {
  return {
    title,
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
      {
        label: i18n.t('common:nav.replayMonitoring'),
        path: `${base}/3d-replay`,
        icon: Play,
      },
    ],
  };
}

const systemGroupOverrides: Record<string, (pathname: string) => NavGroup> = {
  '/crane-detail': (pathname) => {
    const craneId = pathname.split('/')[2];
    if (!craneId) return defaultSystemGroup;
    return buildCmmsGroup(craneId);
  },
  '/outdoor-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    return buildWorkGroup(
      i18n.t('common:nav.outdoorWork'),
      `/outdoor-work/${regionId}`,
    );
  },
  '/indoor-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    return buildWorkGroup(
      i18n.t('common:nav.indoorWork'),
      `/indoor-work/${regionId}`,
    );
  },
  '/goliath-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    return buildWorkGroup(
      i18n.t('common:nav.goliathCrane'),
      `/goliath-work/${regionId}`,
    );
  },
};

export function getNavigationConfig(
  pathname: string,
  _siteType: SiteType,
): NavGroup[] {
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
