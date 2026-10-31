import {
  LayoutDashboard,
  Box,
  History,
  Map,
  LayoutGrid,
  SquarePen,
  TrendingUp,
  Settings,
  Layers,
  ClipboardCheck,
  Wrench,
  Package,
  ShieldCheck,
  MonitorCog,
  CalendarDays,
  FileText,
  DatabaseZap,
  Boxes,
  Brush,
  MonitorPlay,
  RadioTower,
  Tags,
  Library,
  Smartphone,
  Inbox,
} from 'lucide-react';
import { i18n } from '@crane/core/config/i18n';
import type { NavGroup } from '@crane/core/types/navigation';
import type { SiteType } from '@crane/core/lib/site-type-context';
import type { UserRole } from '@crane/features/auth';

const defaultSystemGroup: NavGroup = {
  title: '',
  items: [],
};

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
    ],
  };
}

/**
 * 자산 그룹 — 3D 자산 라이브러리. 조선소·region 과 무관한 전사 공용 화면이라
 * 작업 그룹(region 하위)이 아니라 모니터링 아래에 따로 둔다.
 */
function getAssetsGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.assets'),
    items: [
      {
        label: i18n.t('common:nav.assetLibrary'),
        path: '/asset-library',
        icon: Library,
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
        icon: RadioTower,
      },
      {
        label: i18n.t('common:nav.threeViewerEdit'),
        path: `${base}/3d-viewer-edit`,
        icon: Box,
      },
      {
        label: i18n.t('common:nav.replayMonitoring'),
        path: `${base}/3d-replay`,
        icon: MonitorPlay,
      },
      {
        label: i18n.t('common:nav.tags'),
        path: `${base}/tags`,
        icon: Tags,
      },
      {
        // 감지 설정 페이지(경로는 detection-settings) — 메뉴는 "설정", 맨 아래.
        label: i18n.t('common:nav.settings'),
        path: `${base}/detection-settings`,
        icon: Settings,
      },
    ],
  };
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

function getHmi2Group(): NavGroup {
  return {
    title: i18n.t('common:nav.hmi'),
    items: [
      {
        label: i18n.t('common:nav.hmiPhillyDashboard'),
        path: '/hmi2',
        icon: MonitorCog,
      },
    ],
  };
}

/** Indoorshop.IT — 데이터 게더링 전용 */
function getIndoorshopItGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.indoorshop'),
    items: [
      {
        label: i18n.t('common:nav.indoorshopGathering'),
        path: '/indoorshop/gathering',
        icon: DatabaseZap,
      },
    ],
  };
}

/**
 * 내업 공정 화면의 갈래 [현황 · 실적] — 원본 대시보드 헤더 드롭다운과 같은 쿼리(`?view=`).
 * 헤더 가로 메뉴가 항목 아래로 편다.
 */
function indoorshopViews(path: string) {
  return [
    {
      label: i18n.t('common:nav.indoorshopViewStatus'),
      path: `${path}?view=status`,
    },
    {
      label: i18n.t('common:nav.indoorshopViewPerformance'),
      path: `${path}?view=performance`,
    },
  ];
}

/** Indoorshop.OT — 통합 대시보드 (게더링은 IT 계정 몫이라 여기 없다) */
function getIndoorshopOtGroups(): NavGroup[] {
  return [
    {
      title: i18n.t('common:nav.indoorshopOverview'),
      items: [
        {
          label: i18n.t('common:nav.indoorshopDashboard'),
          path: '/indoorshop',
          icon: LayoutDashboard,
        },
        // 통합실적 — 원본 내비에서 '/'(현황판)와 형제인 전역 화면
        {
          label: i18n.t('common:nav.indoorshopPerformance'),
          path: '/indoorshop/performance',
          icon: TrendingUp,
        },
      ],
    },
    {
      title: i18n.t('common:nav.indoorshopZones'),
      items: [
        {
          label: i18n.t('common:nav.indoorshopFabrication'),
          path: '/indoorshop/zones/fabrication',
          icon: Layers,
        },
        {
          label: i18n.t('common:nav.indoorshopAssembly'),
          path: '/indoorshop/zones/assembly',
          children: indoorshopViews('/indoorshop/zones/assembly'),
          icon: Boxes,
        },
        {
          label: i18n.t('common:nav.indoorshopOutfitting'),
          path: '/indoorshop/zones/outfitting',
          children: indoorshopViews('/indoorshop/zones/outfitting'),
          icon: Wrench,
        },
        {
          label: i18n.t('common:nav.indoorshopPainting'),
          path: '/indoorshop/zones/painting',
          children: indoorshopViews('/indoorshop/zones/painting'),
          icon: Brush,
        },
      ],
    },
    {
      title: i18n.t('common:nav.indoorshopLogistics'),
      items: [
        {
          label: i18n.t('common:nav.indoorshopYard'),
          path: '/indoorshop/logistics/yard',
          icon: Map,
        },
      ],
    },
    {
      title: i18n.t('common:nav.indoorshopReference'),
      items: [
        {
          label: i18n.t('common:nav.indoorshopDocs'),
          path: '/indoorshop/docs',
          icon: FileText,
        },
      ],
    },
  ];
}

function getKeyinGroup(): NavGroup {
  return {
    title: i18n.t('common:nav.indoorshop'),
    items: [
      {
        label: i18n.t('common:nav.indoorshopKeyin'),
        path: '/keyin',
        icon: SquarePen,
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

/**
 * MRO2 — 관리자 메뉴는 데스크톱, 현장 점검은 휴대폰에서만. 휴대폰 폭은 레이아웃이
 * 현장 모드로 리다이렉트하므로 관리자 메뉴를 보여 줘도 갈 수 없다.
 */
function getMro2Group(): NavGroup {
  return {
    title: i18n.t('mro2:nav.group'),
    items: [
      {
        label: i18n.t('mro2:nav.overview'),
        path: '/mro2',
        icon: LayoutDashboard,
        viewport: 'desktop',
        end: true,
      },
      {
        label: i18n.t('mro2:nav.triage'),
        path: '/mro2/triage',
        icon: Inbox,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.assets'),
        path: '/mro2/assets',
        icon: Layers,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.serviceRequests'),
        path: '/mro2/service-requests',
        icon: ClipboardCheck,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.serviceCalendar'),
        path: '/mro2/calendar',
        icon: CalendarDays,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.spend'),
        path: '/mro2/spend',
        icon: TrendingUp,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.inventory'),
        path: '/mro2/inventory',
        icon: Package,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.documents'),
        path: '/mro2/documents',
        icon: FileText,
        viewport: 'desktop',
      },
      {
        label: i18n.t('mro2:nav.field'),
        path: '/mro2/field',
        icon: Smartphone,
        viewport: 'mobile',
      },
    ],
  };
}

const systemGroupOverrides: Record<string, (pathname: string) => NavGroup> = {
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
};

// role 별로 허용된 systemGroup prefix
const ALLOWED_SYSTEM_PREFIXES: Record<UserRole, string[]> = {
  ocean: ['/outdoor-work', '/indoor-work'],
  philly: ['/outdoor-work', '/indoor-work'],
  mro: [],
  mro2: [],
  hmi: [],
  hmi2: [],
  indoorshop: [],
  'indoorshop-ot': [],
  keyin: [],
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

  // mro2: CRANE MRO 그룹만 노출
  if (role === 'mro2') {
    return [getMro2Group()].filter((g) => g.items.length > 0);
  }

  // hmi: HMI 그룹만 노출
  if (role === 'hmi') {
    return [getHmiGroup()].filter((g) => g.items.length > 0);
  }

  // hmi2: Philly HMI 그룹만 노출
  if (role === 'hmi2') {
    return [getHmi2Group()].filter((g) => g.items.length > 0);
  }

  // indoorshop(IT): 데이터 게더링만
  if (role === 'indoorshop') {
    return [getIndoorshopItGroup()].filter((g) => g.items.length > 0);
  }

  // indoorshop-ot(OT): 내업 통합 대시보드
  if (role === 'indoorshop-ot') {
    return getIndoorshopOtGroups().filter((g) => g.items.length > 0);
  }

  // keyin: 내업 실적 Key-In 그룹만 노출
  if (role === 'keyin') {
    return [getKeyinGroup()].filter((g) => g.items.length > 0);
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

  // 모든 role: Monitoring(도크 현황·지도) + 자산 + work systemGroup
  // MRO 그룹은 'mro' 전용 (위에서 단축 반환)
  groups.push(getMonitoringGroup());
  groups.push(getAssetsGroup());
  groups.push(systemGroup);

  return groups.filter((g) => g.items.length > 0);
}
