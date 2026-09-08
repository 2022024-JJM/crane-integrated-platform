/**
 * 설비 배치 도면 — 공장 하나당 도면 한 장.
 *
 * 화면(설비 현황의 '도면 보기')은 이 파일만 읽는다. 매핑의 정본은
 * `scripts/lib/equipmentLayoutPages.mjs` 이고, 자산과 매니페스트는
 * `scripts/build-equipment-layout-drawings.mjs` 가 함께 굽는다 — 도면이 개정되면
 * 매핑 파일 하나를 고치고 스크립트를 다시 돌린다.
 *
 * ⚠️ 도장 5개 공장(1DOCK·2DOCK·느태·텍사코·GPS)은 이 도면집에 없다 — `null` 이 정상이며,
 *    화면은 그럴 때 버튼을 아예 세우지 않는다(눌러도 안 열리는 버튼을 두지 않는다).
 * ⚠️ 도면에 `Equipment IP List` 표가 실려 있다. 사내 레포 전제로 그대로 싣되, 이 자산을
 *    사외로 내보내지 않는다.
 */
import { LAYOUT_DRAWING_DIR, RAW_LAYOUT_DRAWINGS } from './layoutDrawingsFixture'

export { LAYOUT_DRAWING_REVISION } from './layoutDrawingsFixture'

/** 도면 한 장 */
export interface EquipmentLayoutDrawing {
  /** 원본 PDF 안의 쪽 번호 (1-base) — 종이 도면과 대조할 때 쓴다 */
  page: number
  /** 공장 키 (`YardEquipment.factory` 와 같은 체계) */
  factory: string
  /** 자산 슬러그 */
  slug: string
  /** 표제란 `도명` 그대로 */
  title: string
  /** 도번 (개정 추적의 기준) */
  drawingNo: string
  /** `<img src>` 에 그대로 쓰는 경로 */
  src: string
  /** 이미지 픽셀 크기 — 뷰어가 로드 전에 비율을 잡는다 */
  width: number
  height: number
}

export const EQUIPMENT_LAYOUT_DRAWINGS: readonly EquipmentLayoutDrawing[] =
  RAW_LAYOUT_DRAWINGS.map(([page, factory, slug, title, drawingNo, width, height]) => ({
    page,
    factory,
    slug,
    title,
    drawingNo,
    src: `${import.meta.env.BASE_URL}${LAYOUT_DRAWING_DIR}/${slug}.webp`,
    width,
    height,
  }))

const byFactory = new Map(EQUIPMENT_LAYOUT_DRAWINGS.map((d) => [d.factory, d]))

/** 공장의 배치 도면 — 없으면 null (도장 공장은 도면집에 없다) */
export function layoutDrawingOf(factory: string): EquipmentLayoutDrawing | null {
  return byFactory.get(factory) ?? null
}
