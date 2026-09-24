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

// 샘플 모델(house·crane·gantry_crane·ship·R370·TTC-27·TTC-28·TTC-K5000)과
// 'etc' 카테고리(gc-04 파트 4종)는 어떤 씬도 참조하지 않아 카탈로그에서 뺐다.
// 단 crane·gantry_crane·TTC-27 GLB 는 crane-type-model.ts(자산 크레인 타입 →
// 모델 표)와 goliath-3d-viewer.tsx 가 직접 로드하므로 파일은 남아 있다.
export const sceneModelCatalog: SceneModelCatalogItem[] = [
  withDefaultPreview({
    id: 'goliath-crane',
    label: 'Goliath Crane',
    category: 'outdoor',
    path: '/models/goliath_crane.glb',
    defaultScale: [0.1, 0.1, 0.1],
  }),
  // 옥포 크레인 4종: 미터 실척(옥포 씬 okpo.json 은 1 m/unit). 루트에 베이크된
  // 월드 오프셋은 scripts/unbake-root-transform.mjs 로 제거해 반입했다.
  // Top/Trolly/Link 노드가 구동용 피벗이라 LOD·join 을 걸지 않는다.
  withDefaultPreview({
    id: 'okpo-goliath',
    label: 'Okpo Goliath',
    category: 'outdoor',
    path: '/models/okpo_goliath.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'okpo-oc',
    label: 'Okpo OC',
    category: 'outdoor',
    path: '/models/okpo_oc.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'okpo-tc',
    label: 'Okpo TC',
    category: 'outdoor',
    path: '/models/okpo_tc.glb',
    defaultScale: [1, 1, 1],
  }),
  withDefaultPreview({
    id: 'okpo-ttc',
    label: 'Okpo TTC',
    category: 'outdoor',
    path: '/models/okpo_ttc.glb',
    defaultScale: [1, 1, 1],
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
    id: 'hanwha-ocean-lngc-174k',
    label: 'LNGC 174K',
    category: 'outdoor',
    path: '/models/hanwha-ocean-lngc-174k.glb',
    // 미터 단위 실척(전장 ~300m). origin이 용골 바닥(Y=0)·선체 중심이라
    // floating 없이 기본 드롭(bbox 바닥 = 지면)으로 배치한다.
    defaultScale: [1, 1, 1],
    preview: {
      cameraDirection: [1.24, 0.58, 1.3],
      paddingScale: 1.32,
    },
  },
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
];
