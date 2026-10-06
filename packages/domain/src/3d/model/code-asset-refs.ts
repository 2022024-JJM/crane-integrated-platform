/**
 * 화면 코드가 씬을 거치지 않고 직접 로드하는 모델.
 *
 * 씬과 같은 모양으로 가리킨다 — 자산 id, **버전**, 그 버전의 파일 경로. 경로를
 * 함께 적어 두므로 런타임은 자산 라이브러리를 읽지 않는다. 라이브러리에서
 * 현재 버전이 바뀌어도 코드는 따라가지 않는다: 새 버전을 쓰려면 여기의 버전과
 * 경로를 고친다(에디터에서 씬을 갱신하는 것과 같은 일이다).
 *
 * 자산 화면은 이 표를 사용처로 읽어 "코드에서 사용" 으로 보이고, 쓰이는 버전의
 * 철회와 자산 삭제를 막는다. 표의 id·버전·경로가 `library.json` 과 맞는지는
 * 테스트가 고정한다(features/asset-library 의 code-asset-sources.test).
 *
 * GLB 를 경로 문자열로 직접 적지 않는다 — 새로 직접 로드할 모델이 생기면 여기에
 * 올리고 이 표에서 꺼내 쓴다.
 */
export interface CodeAssetRef {
  /** 자산 id. */
  id: string;
  /** 코드가 쓰는 버전. */
  version: number;
  /** 그 버전의 파일 — public 기준 절대 경로. BASE_URL 은 로더가 붙인다. */
  path: string;
  /** 쓰는 곳 — 자산 화면의 사용처 탭에 그대로 보인다. */
  usedBy: string;
}

export const CODE_ASSETS = {
  goliathCrane: {
    id: 'goliath-crane',
    version: 1,
    path: '/models/goliath_crane.glb',
    usedBy: 'crane-type-model',
  },
  llc002: {
    id: 'llc-002',
    version: 1,
    path: '/models/LLC_002.glb',
    usedBy: 'crane-type-model',
  },
  gantryCrane: {
    id: 'rt-gantry-crane',
    version: 1,
    path: '/models/gantry_crane.glb',
    usedBy: 'crane-type-model, goliath-3d-viewer',
  },
  ttc27: {
    id: 'rt-ttc-27',
    version: 1,
    path: '/models/TTC-27.glb',
    usedBy: 'crane-type-model',
  },
  crane: {
    id: 'rt-crane',
    version: 1,
    path: '/models/crane.glb',
    usedBy: 'crane-type-model',
  },
  goliathCraneBody: {
    id: 'rt-goliath-crane-body',
    version: 1,
    path: '/models/goliath_crane_body.glb',
    usedBy: 'crane-zone-config',
  },
  goliathCraneTrolley: {
    id: 'rt-goliath-crane-trolley',
    version: 1,
    path: '/models/goliath_crane_trolley.glb',
    usedBy: 'crane-zone-config',
  },
  person: {
    id: 'person',
    version: 1,
    path: '/asset-library/files/person/v1/Person.glb',
    usedBy: 'collision-guard',
  },
  worker: {
    id: 'worker',
    version: 1,
    path: '/asset-library/files/worker/v1/Worker.glb',
    usedBy: 'collision-guard',
  },
  car: {
    id: 'car',
    version: 1,
    path: '/asset-library/files/car/v1/Car.glb',
    usedBy: 'collision-guard',
  },
  forkLift: {
    id: 'fork-lift',
    version: 1,
    path: '/asset-library/files/fork-lift/v1/Fork-Lift.glb',
    usedBy: 'collision-guard',
  },
} as const satisfies Record<string, CodeAssetRef>;
