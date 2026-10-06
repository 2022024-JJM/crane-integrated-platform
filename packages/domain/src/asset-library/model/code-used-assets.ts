/**
 * 씬이 아니라 화면 코드가 경로로 직접 읽는 도면 — 내업 대시보드의 설비
 * 배치도다(`apps/indoorshop` 의 layoutDrawingsFixture, public/drawings/
 * equipment-layout). 사용처에 "코드에서 사용" 으로 잡혀 지우거나 철회할 수
 * 없게 한다.
 *
 * 코드가 직접 로드하는 3D 모델은 @crane/domain/3d 의 `CODE_ASSETS` 가 같은
 * 모양으로 들고 있다 — 이 슬라이스는 3D 슬라이스를 import 하지 않아 표가 둘이고,
 * 둘을 합치는 곳은 features/asset-library 다.
 */
export interface CodeUsedAsset {
  /** 자산 id. */
  id: string;
  /** 코드가 가리키는 버전. */
  version: number;
  /** public 절대 경로. 그 버전의 파일 경로와 같아야 한다(테스트가 고정한다). */
  path: string;
  /** 쓰는 곳 — 사용처 탭에 그대로 보인다. */
  usedBy: string;
}

const EQUIPMENT_LAYOUT_FILES = [
  'bos2',
  'bos3',
  'gos',
  'nps',
  'ofd1',
  'ofd-shelter',
  'pas',
  'pbs',
  'pos1',
  'pos2-dumo',
];

export const CODE_USED_DRAWINGS: readonly CodeUsedAsset[] =
  EQUIPMENT_LAYOUT_FILES.map((file) => ({
    id: `dwg-equipment-layout-${file}`,
    version: 1,
    path: `/drawings/equipment-layout/${file}.webp`,
    usedBy: 'indoorshop equipment layout',
  }));
