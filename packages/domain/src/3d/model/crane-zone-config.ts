import type { Vector3Tuple } from '@crane/core/types/math';
import type { CraneType } from '../../asset/model/types';
import type { BomClusterKey } from '../../shared/bom-catalog';

/**
 * 크레인 3D 부품(구역) 선택 설정.
 *
 * craneType 단위로 정의해 크레인이 늘어나도(→100대) 타입만 맞으면 3D 구역
 * 선택이 자동 지원된다. 두 가지 전략을 지원한다:
 *
 * - 'parts':   구역별로 분리된 GLB 파일을 조립 렌더 (실제 메시 단위 hover/클릭).
 *              gc-04 골리앗처럼 파트 파일이 존재할 때 사용.
 * - 'regions': 단일 GLB 위 레이캐스트 히트 지점을 모델 바운딩박스 기준
 *              정규화 [0..1] 영역으로 분류. 통짜 모델도 구역 선택 가능.
 */

export interface CraneZonePart {
  /** GLB 경로 (apps/shell/public 기준, withBaseUrl는 GltfModel이 처리) */
  url: string;
  /** 기준 파트(첫 파트) 상대 오프셋 */
  position: Vector3Tuple;
  scale: Vector3Tuple;
}

/** 모델 전체 바운딩박스 기준 정규화 [0..1] 영역 (min ≤ max) */
export interface CraneZoneRegion {
  min: Vector3Tuple;
  max: Vector3Tuple;
}

export interface CraneZone {
  /** i18n 키(asset-management:detail.zones.{key})와 선택 상태 식별자 */
  key: string;
  /** 이 구역 선택 시 표시할 BOM 클러스터 */
  clusterKeys: BomClusterKey[];
  /** 'parts' 전략: 이 구역을 이루는 파트 파일들 */
  parts?: CraneZonePart[];
  /** 'regions' 전략: 이 구역의 정규화 영역들 (앞선 존이 먼저 매칭됨) */
  regions?: CraneZoneRegion[];
  /**
   * 'parts' 전략의 서브 존: 통짜 파트 GLB 안에서 영역만 따로 선택해야 할 때
   * (예: body 안의 전기실). regions를 이 key를 가진 호스트 존 파트의
   * 바운딩박스 기준 정규화 좌표로 해석한다. 호스트 히트 시 서브 존이
   * 먼저 매칭되고, 어느 서브 존에도 안 걸리면 호스트 존으로 처리된다.
   */
  subRegionsOf?: string;
}

export interface CraneZoneConfig {
  strategy: 'parts' | 'regions';
  zones: CraneZone[];
}

// ─── 골리앗/갠트리: gc-04 파트 조립 ─────────────────────────────────────────
// 트랜스폼은 apps/shell/public/scenes/goliath.json의 검증된 배치를
// body 기준 상대 좌표로 환산한 값. (body/trolly scale 0.48, hook/rope 1은 의도된 값)
const GOLIATH_ZONES: CraneZoneConfig = {
  strategy: 'parts',
  zones: [
    {
      key: 'body',
      clusterKeys: [
        'power-dist',
        'transformer',
        'network',
        'fuse',
        'power-supply',
        'wiring',
        'surge',
        'current-sensing',
        'resistor',
        'instrument',
      ],
      parts: [
        {
          url: '/models/gc-04/gc_04_body.glb',
          position: [0, 0, 0],
          scale: [0.48, 0.48, 0.48],
        },
      ],
    },
    // 전기실/운전실은 body GLB에 통짜로 포함 → body 바운딩박스 기준 영역 선택.
    // 좌표는 gc_04_body.glb 정점 실루엣 분석값: 거더 밴드 y≥0.85, 정면 뷰
    // 화면 우측 = -z(정규화 z≈0) 끝단. dev에서 시각 튜닝 대상.
    {
      key: 'electricalRoom',
      clusterKeys: ['plc', 'enclosure'],
      subRegionsOf: 'body',
      regions: [{ min: [0, 0.78, 0], max: [1, 1, 0.15] }],
    },
    {
      key: 'cabin',
      clusterKeys: ['operator', 'computing', 'cctv'],
      subRegionsOf: 'body',
      regions: [{ min: [0, 0.55, 0], max: [1, 0.78, 0.17] }],
    },
    {
      key: 'trolley',
      clusterKeys: ['dcm-drive', 'motor-starter', 'mech-drive', 'pilot-device'],
      parts: [
        {
          url: '/models/gc-04/gc_04_trolly.glb',
          position: [-0.034, 7.988, -3.355],
          scale: [0.48, 0.48, 0.48],
        },
      ],
    },
    {
      key: 'hookRope',
      clusterKeys: ['mech-drive', 'sensing'],
      parts: [
        {
          url: '/models/gc-04/gc_04_hook_rope.glb',
          position: [-0.032, 5.947, -3.355],
          scale: [1, 1, 1],
        },
      ],
    },
    {
      key: 'hook',
      clusterKeys: ['sensing', 'warning'],
      parts: [
        {
          url: '/models/gc-04/gc_04_hook.glb',
          position: [0.02, 4.694, -3.35],
          scale: [1, 1, 1],
        },
      ],
    },
  ],
};

// ─── 러핑/지브 계열: 단일 모델 + 정규화 영역 분류 ──────────────────────────
// 영역 값은 crane.glb 실루엣 기준 추정치 — dev에서 시각 튜닝 대상.
// 순서 중요: cabin이 machineryHouse보다 먼저 매칭되어야 한다.
const LUFFING_ZONES: CraneZoneConfig = {
  strategy: 'regions',
  zones: [
    {
      key: 'cabin',
      clusterKeys: ['operator', 'computing', 'cctv', 'pilot-device', 'warning'],
      regions: [{ min: [0, 0.28, 0.5], max: [1, 0.55, 1] }],
    },
    {
      key: 'machineryHouse',
      clusterKeys: [
        'plc',
        'network',
        'fuse',
        'power-supply',
        'enclosure',
        'instrument',
        'dcm-drive',
        'motor-starter',
      ],
      regions: [{ min: [0, 0.28, 0], max: [1, 0.55, 1] }],
    },
    {
      key: 'boom',
      clusterKeys: ['sensing', 'warning', 'mech-drive'],
      regions: [{ min: [0, 0.55, 0], max: [1, 1, 1] }],
    },
    {
      key: 'base',
      clusterKeys: [
        'power-dist',
        'transformer',
        'wiring',
        'surge',
        'current-sensing',
        'resistor',
        'mech-drive',
      ],
      regions: [{ min: [0, 0, 0], max: [1, 0.28, 1] }],
    },
  ],
};

// ─── 폴백: 임의 모델용 상/중/하 3밴드 — 신규 타입도 3D 구역 선택 기본 지원 ──
const GENERIC_REGION_ZONES: CraneZoneConfig = {
  strategy: 'regions',
  zones: [
    {
      key: 'upper',
      clusterKeys: ['sensing', 'warning', 'mech-drive', 'cctv'],
      regions: [{ min: [0, 0.62, 0], max: [1, 1, 1] }],
    },
    {
      key: 'middle',
      clusterKeys: [
        'plc',
        'network',
        'fuse',
        'power-supply',
        'enclosure',
        'instrument',
        'dcm-drive',
        'motor-starter',
        'operator',
        'computing',
        'pilot-device',
      ],
      regions: [{ min: [0, 0.3, 0], max: [1, 0.62, 1] }],
    },
    {
      key: 'lower',
      clusterKeys: [
        'power-dist',
        'transformer',
        'wiring',
        'surge',
        'current-sensing',
        'resistor',
      ],
      regions: [{ min: [0, 0, 0], max: [1, 0.3, 1] }],
    },
  ],
};

export const CRANE_ZONE_CONFIG: Partial<Record<CraneType, CraneZoneConfig>> = {
  goliath: GOLIATH_ZONES,
  gantry: GOLIATH_ZONES,
  luffing: LUFFING_ZONES,
  llc: LUFFING_ZONES,
  jib: LUFFING_ZONES,
  overhead: GENERIC_REGION_ZONES,
  ttc: GENERIC_REGION_ZONES,
};

/** 크레인 타입의 3D 구역 설정 (미매핑 타입은 범용 3밴드 폴백) */
export function getCraneZoneConfig(craneType: CraneType): CraneZoneConfig {
  return CRANE_ZONE_CONFIG[craneType] ?? GENERIC_REGION_ZONES;
}
