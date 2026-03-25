import type { SceneModelCatalogItem } from './types';

export const sceneModelCatalog: SceneModelCatalogItem[] = [
  {
    id: 'crane',
    label: 'Crane',
    path: '/models/crane.glb',
    defaultScale: [0.8, 0.8, 0.8],
    preview: {
      cameraDirection: [1.08, 0.72, 1.12],
      paddingScale: 1.24,
    },
  },
  {
    id: 'gantry-crane',
    label: 'Gantry Crane',
    path: '/models/gantry_crane.glb',
    defaultScale: [1.2, 1.2, 1.2],
    preview: {
      cameraDirection: [1, 0.62, 1.12],
      paddingScale: 1.28,
    },
  },
  {
    id: 'house',
    label: 'House',
    path: '/models/house.glb',
    defaultScale: [1, 1, 1],
  },
  {
    id: 'ship',
    label: 'Ship',
    path: '/models/ship.glb',
    defaultScale: [1, 1, 1],
    preview: {
      cameraDirection: [1.24, 0.58, 1.3],
      paddingScale: 1.32,
    },
  },
];
