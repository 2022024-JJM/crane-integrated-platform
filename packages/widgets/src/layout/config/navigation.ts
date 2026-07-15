import {
  LayoutDashboard,
  Box,
  List,
  History,
  Map,
  MonitorCheck,
  LayoutGrid,
  Play,
  SquarePen,
  Activity,
  ArrowUpDown,
  ArrowLeftRight,
  TrendingUp,
  Settings,
  Layers,
  ClipboardCheck,
  Wrench,
  Package,
  ShieldCheck,
  Bell,
  MonitorCog,
  Camera,
  CalendarDays,
  Cctv,
} from 'lucide-react';
import { i18n } from '@crane/core/config/i18n';
import type { NavGroup } from '@crane/core/types/navigation';
import type { SiteType } from '@crane/core/lib/site-type-context';
import type { UserRole } from '@crane/features/auth';

const defaultSystemGroup: NavGroup = {
  title: '',
  items: [],
};

function getOverviewGroup(): NavGroup {
  const items = [
    {
      label: i18n.t('common:nav.dashboard'),
      path: '/',
      icon: LayoutDashboard,
    },
  ];

  return { title: i18n.t('common:nav.overview'), items };
}

function getMonitoringGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.monitoring'),
    items: [
      {
        label: i18n.t('common:nav.dockStatus'),
        path: '/monitoring/dock-status',
        icon: LayoutGrid,
      },
      {
        label: i18n.t('common:nav.map'),
        path: '/monitoring/map',
        icon: Map,
      },
      {
        label: i18n.t('common:nav.cmms'),
        path: '/monitoring/cmms',
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
    highlight: true,
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
        label: i18n.t('common:nav.alarmHistory'),
        path: `${base}/alarm-history`,
        icon: Bell,
      },
      {
        label: i18n.t('common:nav.replayMonitoring'),
        path: `${base}/3d-replay`,
        icon: Play,
      },
    ],
  };
}

function buildGoliathWorkGroup(title: string, base: string): NavGroup {
  const baseGroup = buildWorkGroup(title, base);
  const visionItem = {
    label: i18n.t('common:nav.vision'),
    path: `${base}/vision`,
    icon: Camera,
  };
  const cabinMonitoringItem = {
    label: i18n.t('common:nav.cabinMonitoring'),
    path: `${base}/cabin-monitoring`,
    icon: Cctv,
  };
  const items = [
    baseGroup.items[0],
    visionItem,
    cabinMonitoringItem,
    ...baseGroup.items.slice(1),
  ];
  return { ...baseGroup, items };
}

function getHmiGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.hmi'),
    items: [
      {
        label: i18n.t('common:nav.hmiDashboard'),
        path: '/hmi',
        icon: MonitorCog,
      },
    ],
  };
}

function getMroGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.mro'),
    items: [
      {
        label: i18n.t('common:nav.mroDashboard'),
        path: '/mro-dashboard',
        icon: LayoutDashboard,
      },
      {
        label: i18n.t('common:nav.assetManagement'),
        path: '/asset-management',
        icon: Layers,
      },
      {
        label: i18n.t('common:nav.inspection'),
        path: '/inspection',
        icon: ClipboardCheck,
      },
      {
        label: i18n.t('common:nav.maintenance'),
        path: '/maintenance',
        icon: Wrench,
      },
      {
        label: i18n.t('common:nav.history'),
        path: '/history',
        icon: History,
      },
      {
        label: i18n.t('common:nav.serviceCalendar'),
        path: '/service-calendar',
        icon: CalendarDays,
      },
      {
        label: i18n.t('common:nav.inventory'),
        path: '/inventory',
        icon: Package,
      },
      {
        label: i18n.t('common:nav.compliance'),
        path: '/compliance',
        icon: ShieldCheck,
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
    return buildGoliathWorkGroup(
      i18n.t('common:nav.goliathCrane'),
      `/goliath-work/${regionId}`,
    );
  },
};

// role 별로 허용된 systemGroup prefix
const ALLOWED_SYSTEM_PREFIXES: Record<UserRole, string[]> = {
  ocean: ['/crane-detail', '/outdoor-work', '/indoor-work'],
  goliath: ['/goliath-work'],
  philly: ['/crane-detail', '/outdoor-work', '/indoor-work'],
  mro: [],
  hmi: [],
};

export function getNavigationConfig(
  pathname: string,
  _siteType: SiteType,
  role: UserRole = 'ocean',
): NavGroup[] {
  // mro: MRO 그룹만 노출 (Overview/Monitoring/System 모두 숨김)
  if (role === 'mro') {
    return [getMroGroup()].filter((g) => g.items.length > 0);
  }

  // hmi: HMI 그룹만 노출
  if (role === 'hmi') {
    return [getHmiGroup()].filter((g) => g.items.length > 0);
  }

  const matchedKey = Object.keys(systemGroupOverrides).find((prefix) =>
    pathname.startsWith(prefix),
  );

  const allowed = ALLOWED_SYSTEM_PREFIXES[role];
  const systemGroup =
    matchedKey && allowed.includes(matchedKey)
      ? systemGroupOverrides[matchedKey](pathname)
      : defaultSystemGroup;

  const groups: NavGroup[] = [];

  // 모든 role: Overview(Dashboard) + Monitoring(3개) + work systemGroup
  // MRO 그룹은 'mro' 전용 (위에서 단축 반환)
  groups.push(getOverviewGroup());
  groups.push(getMonitoringGroup());
  groups.push(systemGroup);

  return groups.filter((g) => g.items.length > 0);
}

export const navigationConfig: NavGroup[] = [
  getOverviewGroup(),
  getMonitoringGroup(),
  defaultSystemGroup,
  getMroGroup(),
];
