/*
 * 설비 배치 도면 매니페스트 — **생성물이므로 손으로 고치지 않는다.**
 *
 * 출처: painting `data/Equipment Layout (조립, 의장)_R0_260903.pdf` (16장 · 한 장 = 한 공장).
 * 생성: `node scripts/build-equipment-layout-drawings.mjs` 를 다시 돌리면 이 파일과
 *       `public/drawings/equipment-layout/` 자산을 함께 덮어쓴다.
 * 매핑(페이지 ↔ 공장)의 단일 소스는 `scripts/lib/equipmentLayoutPages.mjs` 다 —
 * 도면이 개정되면 그 파일 하나를 고치고 이 스크립트를 다시 돌린다.
 *
 * ⚠️ 원본 PDF 는 커밋하지 않는다(사내 도면). 변환 산출물만 레포에 있다.
 * ⚠️ 도면에 `Equipment IP List` 표가 실려 있다 — 사내 레포 전제로 그대로 둔다.
 */

/** [페이지(1-base), 공장 키, 자산 슬러그, 표제란 도명, 도번, 이미지 폭(px), 높이(px)] */
export type RawLayoutDrawing = readonly [
  number, string, string, string, string, number, number,
]

/** 도면 개정 표시 */
export const LAYOUT_DRAWING_REVISION = "R0 · 260903"

/** 자산 기준 경로 (public 하위) */
export const LAYOUT_DRAWING_DIR = "drawings/equipment-layout"

export const RAW_LAYOUT_DRAWINGS: readonly RawLayoutDrawing[] = [
  [1, "PBS", "pbs", "조립 1공장 (PBS)", "HOOP-HEC-EL-110000-00", 1988, 1406],
  [2, "3DS", "3ds", "조립 2공장 (3SD)", "HOOP-HEC-EL-120000-00", 1988, 1406],
  [3, "NPS", "nps", "조립 3공장 (NPS)", "HOOP-HEC-EL-130000-00", 1988, 1406],
  [4, "조립4공장-OFD1", "ofd1", "조립 4공장 (OFD1)", "HOOP-HEC-EL-140000-00", 1988, 1406],
  [5, "조립4공장-OFD2", "ofd2", "조립 4공장 (OFD2)", "HOOP-HEC-EL-150000-00", 1988, 1406],
  [6, "조립4공장-OFD3", "ofd3", "조립 4공장 (OFD3)", "HOOP-HEC-EL-160000-00", 1988, 1406],
  [7, "GBS", "gbs", "조립 5공장 (GBS)", "HOOP-HEC-EL-170000-00", 1988, 1406],
  [8, "PAS", "pas", "중조립 공장 (PAS)", "HOOP-HEC-EL-180000-00", 1988, 1406],
  [9, "CAS", "cas", "소부재 조립 공장 (CAS)", "HOOP-HEC-EL-190000-00", 1988, 1406],
  [10, "POS 1공장", "pos1", "선행의장 1공장", "HOOP-HEC-EL-210000-00", 1988, 1406],
  [11, "두모 선행의장 2공장", "pos2-dumo", "선행의장 2공장", "HOOP-HEC-EL-220000-00", 1988, 1406],
  [12, "조립의장 1공장 BOS 1", "bos1", "조립의장 1공장 (BOS1)", "HOOP-HEC-EL-230000-00", 1988, 1406],
  [13, "조립의장 2공장 BOS 2", "bos2", "조립의장 2공장 (BOS2)", "HOOP-HEC-EL-240000-00", 1988, 1406],
  [14, "조립의장 3공장 쉘터", "bos3", "조립의장 3공장", "HOOP-HEC-EL-250000-00", 1988, 1406],
  [15, "GOS 조립의장 쉘터", "gos", "GOS 의장셸터", "HOOP-HEC-EL-260000-00", 1988, 1406],
  [16, "OFD조립의장 셸터", "ofd-shelter", "OFD 의장셸터", "HOOP-HEC-EL-270000-00", 1988, 1406],
]
