import type { Vector3Tuple } from '@crane/core/types/math';
import type { CraneType } from '../../asset/model/types';

export interface CraneModelCameraPreset {
  defaultPosition: Vector3Tuple;
  defaultTarget: Vector3Tuple;
  topViewPosition?: Vector3Tuple;
  topViewTarget?: Vector3Tuple;
}

export interface CraneModelConfig {
  /** GLB 경로 (apps/shell/public/models/ 기준) */
  url: string;
  scale: Vector3Tuple;
  cameraPreset: CraneModelCameraPreset;
}

// 갠트리/골리앗 계열 — Goliath3dViewer 프리셋 재사용
const GANTRY: CraneModelConfig = {
  url: '/models/gantry_crane.glb',
  scale: [1.2, 1.2, 1.2],
  cameraPreset: {
    defaultPosition: [15, 12, 20],
    defaultTarget: [0, 4, 0],
    topViewPosition: [0, 30, 0],
    topViewTarget: [0, 0, 0],
  },
};

const TTC: CraneModelConfig = {
  url: '/models/TTC-27.glb',
  scale: [0.1, 0.1, 0.1],
  cameraPreset: {
    defaultPosition: [18, 14, 22],
    defaultTarget: [0, 5, 0],
    topViewPosition: [0, 34, 0],
    topViewTarget: [0, 0, 0],
  },
};

// 전용 모델이 없는 타입의 폴백 — 범용 크레인
const GENERIC: CraneModelConfig = {
  url: '/models/crane.glb',
  scale: [0.8, 0.8, 0.8],
  cameraPreset: {
    defaultPosition: [14, 11, 18],
    defaultTarget: [0, 3.5, 0],
    topViewPosition: [0, 28, 0],
    topViewTarget: [0, 0, 0],
  },
};

export const CRANE_TYPE_MODEL: Record<CraneType, CraneModelConfig> = {
  goliath: GANTRY,
  gantry: GANTRY,
  ttc: TTC,
  luffing: GENERIC,
  llc: GENERIC,
  jib: GENERIC,
  overhead: GENERIC,
};

/** 크레인 타입에 맞는 3D 모델 설정을 반환 (미매핑 시 범용 크레인 폴백) */
export function getCraneModel(craneType: CraneType): CraneModelConfig {
  return CRANE_TYPE_MODEL[craneType] ?? GENERIC;
}
