import type { Region } from "./types";

export const regions: Region[] = [
  {
    id: "dock-1",
    status: "normal",
    statusSummary: { normal: 6, warning: 2, critical: 0 },
    navigateTo: "/outdoor-work/dock-1",
  },
  {
    id: "dock-2",
    status: "warning",
    statusSummary: { normal: 4, warning: 1, critical: 1 },
    navigateTo: "/outdoor-work/dock-2",
  },
  {
    id: "dock-3",
    status: "critical",
    statusSummary: { normal: 2, warning: 0, critical: 2 },
    navigateTo: "/outdoor-work/dock-3",
  },
];

export function getRegionById(regionId: string) {
  return regions.find((region) => region.id === regionId)
}
