import type { SceneModelCatalogItem } from './types';

export const sceneModelCatalog: SceneModelCatalogItem[] = [
  {
    id: 'crane',
    label: 'Crane',
    path: '/models/crane.glb',
    defaultScale: [0.8, 0.8, 0.8],
    preview: {
      fitScale: 0.58,
      centerYRatio: 0.3,
      targetYRatio: 0.12,
      cameraDistanceMultiplier: 1.9,
      cameraDirection: [1.08, 0.66, 1.14],
    },
  },
  {
    id: 'gantry-crane',
    label: 'Gantry Crane',
    path: '/models/gantry_crane.glb',
    defaultScale: [1.2, 1.2, 1.2],
    preview: {
      fitScale: 0.42,
      centerYRatio: 0.24,
      targetYRatio: 0.1,
      cameraDistanceMultiplier: 2.35,
      cameraDirection: [1.02, 0.58, 1.22],
    },
  },
  {
    id: 'house',
    label: 'House',
    path: '/models/house.glb',
    defaultScale: [1, 1, 1],
    preview: {
      fitScale: 0.8,
      centerYRatio: 0.5,
      targetYRatio: 0.03,
      cameraDistanceMultiplier: 1.35,
      cameraDirection: [1.25, 0.72, 1.18],
    },
  },
  {
    id: 'ship',
    label: 'Ship',
    path: '/models/ship.glb',
    defaultScale: [1, 1, 1],
    preview: {
      fitScale: 0.56,
      centerYRatio: 0.38,
      targetYRatio: 0.05,
      cameraDistanceMultiplier: 1.9,
      cameraDirection: [1.34, 0.48, 1.5],
    },
  },
];
