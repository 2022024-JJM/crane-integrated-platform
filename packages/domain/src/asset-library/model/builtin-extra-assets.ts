import type { BuiltinAssetSource } from './types';

/**
 * 씬 편집기 카탈로그에 없는 배포 자산.
 *
 * 모델 8종은 팔레트로 배치하지 않고 **코드가 직접 로드**한다(자산 크레인
 * 타입 표, 골리앗 부품 조립, 충돌 가드 시뮬레이션 객체 — 목록의 근거는
 * docs/agents/assets-glb.md "카탈로그 밖에서 직접 로드하는 GLB"). 씬 JSON 과
 * 카탈로그만 보고 지워지지 않도록 라이브러리에 올려 둔다.
 *
 * 도면은 내업 대시보드의 설비 배치도다(public/drawings/equipment-layout).
 */
export const builtinRuntimeModelSources: BuiltinAssetSource[] = [
  {
    id: 'rt-crane',
    kind: 'model',
    name: 'Crane (MRO)',
    path: '/models/crane.glb',
    tags: ['runtime', 'MRO'],
  },
  {
    id: 'rt-gantry-crane',
    kind: 'model',
    name: 'Gantry Crane (MRO)',
    path: '/models/gantry_crane.glb',
    tags: ['runtime', 'MRO'],
  },
  {
    id: 'rt-ttc-27',
    kind: 'model',
    name: 'TTC-27 (MRO)',
    path: '/models/TTC-27.glb',
    tags: ['runtime', 'MRO'],
  },
  {
    id: 'rt-goliath-crane-body',
    kind: 'model',
    name: 'Goliath Crane Body',
    path: '/models/goliath_crane_body.glb',
    tags: ['runtime', 'MRO', 'part', 'philly'],
  },
  {
    id: 'rt-goliath-crane-trolley',
    kind: 'model',
    name: 'Goliath Crane Trolley',
    path: '/models/goliath_crane_trolley.glb',
    tags: ['runtime', 'MRO', 'part', 'philly'],
  },
  {
    id: 'rt-man',
    kind: 'model',
    name: 'Worker',
    path: '/models/man.glb',
    tags: ['runtime', 'collision-guard'],
  },
  {
    id: 'rt-car',
    kind: 'model',
    name: 'Vehicle',
    path: '/models/car.glb',
    tags: ['runtime', 'collision-guard'],
  },
  {
    id: 'rt-fork-lift',
    kind: 'model',
    name: 'Forklift',
    path: '/models/fork_lift.glb',
    tags: ['runtime', 'collision-guard'],
  },
];

const EQUIPMENT_LAYOUTS: [file: string, name: string][] = [
  ['bos2', 'BOS2'],
  ['bos3', 'BOS3'],
  ['gos', 'GOS'],
  ['nps', 'NPS'],
  ['ofd1', 'OFD1'],
  ['ofd-shelter', 'OFD Shelter'],
  ['pas', 'PAS'],
  ['pbs', 'PBS'],
  ['pos1', 'POS1'],
  ['pos2-dumo', 'POS2 DUMO'],
];

export const builtinDrawingSources: BuiltinAssetSource[] =
  EQUIPMENT_LAYOUTS.map(([file, name]) => ({
    id: `dwg-equipment-layout-${file}`,
    kind: 'drawing',
    name: `${name} Equipment Layout`,
    path: `/drawings/equipment-layout/${file}.webp`,
    tags: ['equipment-layout', 'indoor', 'okpo'],
  }));
