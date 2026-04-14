import type { CraneRegistryEntry } from './types';

const craneRegistry: CraneRegistryEntry[] = [
  {
    craneId: 'C_171',
    craneName: 'C_171',
    craneNo: 'C-171',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_172',
    craneName: 'C_172',
    craneNo: 'C-172',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_173',
    craneName: 'C_173',
    craneNo: 'C-173',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_800',
    craneName: 'C_800',
    craneNo: 'C-800',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_801',
    craneName: 'C_801',
    craneNo: 'C-801',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_810',
    craneName: 'C_810',
    craneNo: 'C-810',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_811',
    craneName: 'C_811',
    craneNo: 'C-811',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_812',
    craneName: 'C_812',
    craneNo: 'C-812',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_863',
    craneName: 'C_863',
    craneNo: 'C-863',
    regionId: 'dock-1',
  },
  {
    craneId: 'C_864',
    craneName: 'C_864',
    craneNo: 'C-864',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_865',
    craneName: 'C_865',
    craneNo: 'C-865',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_866',
    craneName: 'C_866',
    craneNo: 'C-866',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_867',
    craneName: 'C_867',
    craneNo: 'C-867',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_868',
    craneName: 'C_868',
    craneNo: 'C-868',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_869',
    craneName: 'C_869',
    craneNo: 'C-869',
    regionId: 'dock-2',
  },
  {
    craneId: 'C_862',
    craneName: 'C_862',
    craneNo: 'C-862',
    regionId: 'dock-in',
  },
  {
    craneId: 'C_870',
    craneName: 'C_870',
    craneNo: 'C-870',
    regionId: 'dock-in',
  },
  {
    craneId: 'C_871',
    craneName: 'C_871',
    craneNo: 'C-871',
    regionId: 'dock-in',
  },
  {
    craneId: 'C_890',
    craneName: 'C_890',
    craneNo: 'C-890',
    regionId: 'dock-in',
  },
  {
    craneId: 'C_1806',
    craneName: 'C_1806',
    craneNo: 'C-1806',
    regionId: 'dock-in',
  },
  {
    craneId: 'GC_04',
    craneName: 'GC-04',
    craneNo: 'GC-04',
    regionId: 'goliath',
  },
];

const craneRegistryById = new Map(
  craneRegistry.map((entry) => [entry.craneId, entry] as const),
);

const craneIdsByRegion: Record<string, string[]> = {
  'dock-1': [
    'C_171',
    'C_172',
    'C_173',
    'C_800',
    'C_801',
    'C_810',
    'C_811',
    'C_812',
    'C_863',
  ],
  'dock-2': ['C_864', 'C_865', 'C_866', 'C_867', 'C_868', 'C_869'],
  'dock-in': [
    'C_801',
    'C_800',
    'C_172',
    'C_173',
    'C_171',
    'C_811',
    'C_810',
    'C_812',
    'C_864',
    'C_867',
    'C_863',
    'C_866',
    'C_865',
    'C_862',
    'C_871',
    'C_868',
    'C_869',
    'C_870',
    'C_1806',
  ],
  goliath: ['GC_04'],
};

export function getCraneById(craneId: string) {
  return craneRegistryById.get(craneId);
}

export function getCraneIdsByRegion(regionId: string) {
  const regionCraneIds = craneIdsByRegion[regionId];

  if (regionCraneIds) {
    return regionCraneIds;
  }

  return craneRegistry
    .filter((entry) => entry.regionId === regionId)
    .map((entry) => entry.craneId);
}

export function getCraneNameById(craneId: string) {
  return getCraneById(craneId)?.craneName;
}
