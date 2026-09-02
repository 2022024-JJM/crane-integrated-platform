import type { SceneModelCatalogItem, SceneModelPreviewPreset } from './types';

const DEFAULT_PREVIEW: SceneModelPreviewPreset = {
  cameraDirection: [1.08, 0.72, 1.12],
  paddingScale: 1.24,
};

function withDefaultPreview(
  item: Omit<SceneModelCatalogItem, 'preview'>,
): SceneModelCatalogItem {
  return {
    ...item,
    preview: DEFAULT_PREVIEW,
  };
}

export const sceneModelCatalog: SceneModelCatalogItem[] = [
  {
    id: 'crane',
    label: 'Crane',
    category: 'outdoor',
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
    category: 'outdoor',
    path: '/models/gantry_crane.glb',
    defaultScale: [1.2, 1.2, 1.2],
    preview: {
      cameraDirection: [1, 0.62, 1.12],
      paddingScale: 1.28,
    },
  },
  withDefaultPreview({
    id: 'goliath-crane',
    label: 'Goliath Crane',
    category: 'outdoor',
    path: '/models/goliath_crane.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: 'llc-002',
    label: 'LLC-002',
    category: 'outdoor',
    path: '/models/LLC_002.glb',
    // 리깅본(Empty 피벗 계층). 루트 scale 을 자식에 접어 넣어 실제 미터라
    // 배치 scale 은 1 이다(assets-src/README.md, unbake --fold-scale 참고).
    defaultScale: [1, 1, 1],
  }),
  // Block_001/002: 필리조선소 export 와 같은 미터 단위 원본. 루트 노드에 월드
  // 포즈가 베이크돼 있어 scripts/unbake-root-transform.mjs 로 원점 복원 후 반입.
  withDefaultPreview({
    id: 'block-001',
    label: 'Block-001',
    category: 'outdoor',
    path: '/models/Block_001.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'block-002',
    label: 'Block-002',
    category: 'outdoor',
    path: '/models/Block_002.glb',
    defaultScale: [1, 1, 1],
  }),
  {
    id: 'house',
    label: 'House',
    category: 'indoor',
    path: '/models/house.glb',
    defaultScale: [1, 1, 1],
  },
  {
    id: 'ship',
    label: 'Ship',
    category: 'outdoor',
    path: '/models/ship.glb',
    defaultScale: [1, 1, 1],
    preview: {
      cameraDirection: [1.24, 0.58, 1.3],
      paddingScale: 1.32,
    },
    // ship.glb는 origin이 흘수선(용골 -1.03, 상부 +4.63)이라 수면에 그대로 놓는다.
    floating: true,
  },
  withDefaultPreview({
    id: 'r370',
    label: 'R370',
    category: 'outdoor',
    path: '/models/R370.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: 'ttc-27',
    label: 'TTC-27',
    category: 'outdoor',
    path: '/models/TTC-27.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: 'ttc-28',
    label: 'TTC-28',
    category: 'outdoor',
    path: '/models/TTC-28.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: 'ttc-k5000',
    label: 'TTC-K5000',
    category: 'outdoor',
    path: '/models/TTC-K5000.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: '1p-3bay',
    label: '1P 3Bay',
    category: 'indoor',
    path: '/models/1p_3bay.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  withDefaultPreview({
    id: '3p',
    label: '3P',
    category: 'indoor',
    path: '/models/3p.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: '5p-1bay',
    label: '5P 1Bay',
    category: 'indoor',
    path: '/models/5p_1bay.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: '5p-2bay',
    label: '5P 2Bay',
    category: 'indoor',
    path: '/models/5p_2bay.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-171',
    label: 'C-171',
    category: 'indoor',
    path: '/models/c_171.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-172',
    label: 'C-172',
    category: 'indoor',
    path: '/models/c_172.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-173',
    label: 'C-173',
    category: 'indoor',
    path: '/models/c_173.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-800',
    label: 'C-800',
    category: 'indoor',
    path: '/models/c_800.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-801',
    label: 'C-801',
    category: 'indoor',
    path: '/models/c_801.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-810',
    label: 'C-810',
    category: 'indoor',
    path: '/models/c_810.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-811',
    label: 'C-811',
    category: 'indoor',
    path: '/models/c_811.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-862',
    label: 'C-862',
    category: 'indoor',
    path: '/models/c_862.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-863',
    label: 'C-863',
    category: 'indoor',
    path: '/models/c_863.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-864',
    label: 'C-864',
    category: 'indoor',
    path: '/models/c_864.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-865',
    label: 'C-865',
    category: 'indoor',
    path: '/models/c_865.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-866',
    label: 'C-866',
    category: 'indoor',
    path: '/models/c_866.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-867',
    label: 'C-867',
    category: 'indoor',
    path: '/models/c_867.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-868',
    label: 'C-868',
    category: 'indoor',
    path: '/models/c_868.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-869',
    label: 'C-869',
    category: 'indoor',
    path: '/models/c_869.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-870',
    label: 'C-870',
    category: 'indoor',
    path: '/models/c_870.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-871',
    label: 'C-871',
    category: 'indoor',
    path: '/models/c_871.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'c-1806',
    label: 'C-1806',
    category: 'indoor',
    path: '/models/c_1806.glb',
    defaultScale: [1, 1, 1],
  }),
  // factory-sample-01~03 제거 (2026-08-14): /models/factory_sample_0*.glb 파일이
  // 리포에 없어 팔레트에 깨진 타일이 뜨고, 에디터를 열 때마다 404 프리로드가
  // 나가고, 드롭하면 실패했다. 어떤 씬도 참조하지 않아 안전하게 뺐다.
  // 에셋을 확보하면 다시 추가할 것 — 파일부터 넣고 등록하는 순서로.
  withDefaultPreview({
    id: 'gc-04-body',
    label: 'GC-04 Body',
    category: 'etc',
    path: '/models/gc-04/gc_04_body.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'gc-04-hook',
    label: 'GC-04 Hook',
    category: 'etc',
    path: '/models/gc-04/gc_04_hook.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'gc-04-hook-rope',
    label: 'GC-04 Hook Rope',
    category: 'etc',
    path: '/models/gc-04/gc_04_hook_rope.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'gc-04-trolly',
    label: 'GC-04 Trolly',
    category: 'etc',
    path: '/models/gc-04/gc_04_trolly.glb',
    defaultScale: [1, 1, 1],
  }),
  // gc-04 카메라/포인트/라이다 FOV(soslab, ouster) 4종 제거 (2026-09-01):
  // 어떤 씬도 참조하지 않았고, GLB(배포본·assets-src 원본)와 썸네일도 함께
  // 삭제했다. 다시 필요하면 git 히스토리에서 파일부터 복구하고 재등록할 것.
];
