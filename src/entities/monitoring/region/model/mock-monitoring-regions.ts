import type { MonitoringRegion } from './monitoring-region';

export const monitoringRegions: MonitoringRegion[] = [
  {
    id: '1dock',
    name: '1 도크',
    siteName: '타워 & 골리앗',
    craneCount: 8,
    status: 'normal',
    statusLabel: '정상 운영 중',
    screens: ['실시간 3D 모니터링', '장비 상태 대시보드'],
    route: '/outdoor-work',
  },
  {
    id: '2dock',
    name: '2 도크',
    siteName: '타워 & 골리앗',
    craneCount: 0,
    status: 'warning',
    statusLabel: '준비중 입니다...',
    screens: ['실시간 3D 모니터링', '장비 상태 대시보드'],
    route: '/',
  },
  {
    id: 'indoor-work',
    name: '내업',
    siteName: '오버헤드',
    craneCount: 6,
    status: 'normal',
    statusLabel: '정상 운영 중',
    screens: ['실시간 3D 모니터링', '충돌 방지 시스템', '장비 상태 대시보드'],
    route: '/indoor-work',
  },
];
