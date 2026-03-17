import type { Region } from "./types";

export const regions: Region[] = [
  {
    id: "dock-1",
    title: "1 도크",
    subtitle: "야드 & 플리팅 · 크레인 8기",
    status: "normal",
    links: [
      {
        label: "실시간 3D 모니터링",
        path: "/outdoor-work/dock-1/3d-monitoring",
      },
      { label: "크레인 상태 목록", path: "/outdoor-work/dock-1/crane-status" },
    ],
    statusSummary: { normal: 6, warning: 2, critical: 0 },
    navigateTo: "/outdoor-work/dock-1",
  },
  {
    id: "dock-2",
    title: "2 도크",
    subtitle: "컨테이너 하역 · 크레인 6기",
    status: "warning",
    links: [
      {
        label: "실시간 3D 모니터링",
        path: "/outdoor-work/dock-2/3d-monitoring",
      },
      { label: "크레인 상태 목록", path: "/outdoor-work/dock-2/crane-status" },
    ],
    statusSummary: { normal: 4, warning: 1, critical: 1 },
    navigateTo: "/outdoor-work/dock-2",
  },
  {
    id: "dock-3",
    title: "3 도크",
    subtitle: "벌크 화물 · 크레인 4기",
    status: "critical",
    links: [
      {
        label: "실시간 3D 모니터링",
        path: "/outdoor-work/dock-3/3d-monitoring",
      },
      { label: "크레인 상태 목록", path: "/outdoor-work/dock-3/crane-status" },
    ],
    statusSummary: { normal: 2, warning: 0, critical: 2 },
    navigateTo: "/outdoor-work/dock-3",
  },
];
