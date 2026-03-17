import { LayoutDashboard, Box, List, History, MapPin } from 'lucide-react';
import type { NavGroup } from '@/shared/types';

const overviewGroup: NavGroup = {
  title: 'Overview',
  items: [
    { label: '대시보드', path: '/', icon: LayoutDashboard },
    { label: '지역 선택', path: '/region-overview', icon: MapPin },
  ],
};

const defaultSystemGroup: NavGroup = {
  title: '',
  items: [],
};

const systemGroupOverrides: Record<string, (pathname: string) => NavGroup> = {
  '/outdoor-work': (pathname) => {
    const regionId = pathname.split('/')[2] || '';
    const base = `/outdoor-work/${regionId}`;
    return {
      title: 'Outdoor Work',
      items: [
        {
          label: '실시간 3D 모니터링',
          path: `${base}/3d-monitoring`,
          icon: Box,
        },
        { label: '크레인 상태 목록', path: `${base}/crane-status`, icon: List },
        { label: '작업 이력', path: `${base}/work-history`, icon: History },
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
  return [overviewGroup, systemGroup];
}

export const navigationConfig: NavGroup[] = [overviewGroup, defaultSystemGroup];
