import type { PaintingStepId } from '../model/types'

/*
 * 도장 스텝 ↔ 레거시 키 매핑 — **매핑이 바뀌면 이 파일만 수정한다.**
 *
 * 근거: YPWP720M 실데이터 3,996행 유도(2026-09-03). 분포표는 `.work/`(비커밋),
 * 유도 서술은 「선행도장권역 Legacy 데이터플로우」 §3.3.
 *
 * 유도 결과 세 가지가 확인됐다.
 *  1. 스텝 축은 `PNT_SEQ` 가 **아니라** `ELMT_ITEM_CODE` 다. `PNT_SEQ` 는 같은
 *     (호선·블록·존·W/O·상세공정) 안에서 여러 값을 가지므로 **반복 회차**이지 스텝이 아니다.
 *  2. `PNT_WORK_KIND` 는 'P'(도장)·'C'(전처리) 2값뿐이다 — 'F' 같은 값은 없다.
 *     Q0·R0·T0 는 두 공종에 모두 나타나므로 **(공종, 요소코드) 쌍**이라야 유일하다
 *     (16개 조합 ↔ `PNT_DETL_PRCS_NM` 16종이 1:1).
 *  3. `PNT_DETL_PRCS_CD` = `PNT_WORK_KIND` ‖ `MAJ_CODE` ‖ `STRC_SPCL_CODE` ‖
 *     `PNT_PRCS_SEQ` ‖ `ELMT_ITEM_CODE` (3,996행 전건 일치) — 상세공정코드만 있어도
 *     끝 2자리로 요소코드를 얻을 수 있다.
 *
 * 현업 공식 확정이 오면 또 바뀔 수 있으므로 구조(상수 한 곳 + 판별 함수)는 그대로 둔다.
 * mock 생성기·실연동 쿼리 모두 이 표만 경유하고, 스텝 코드값을 하드코딩으로 흩뜨리지 않는다.
 */

/** YPWP720M.PNT_WORK_KIND — 도장 공종 */
export const PNT_WORK_KIND_PAINT = 'P'
/** YPWP720M.PNT_WORK_KIND — 전처리 공종(작업준비·블라스팅·GRIT수거·검사·TAPE설치) */
export const PNT_WORK_KIND_PREP = 'C'

export interface PaintingStepLegacyKey {
  /** YPWP720M.PNT_WORK_KIND — 스텝은 전부 도장 공종('P')이다 */
  pntWorkKind: typeof PNT_WORK_KIND_PAINT
  /**
   * YPWP720M.ELMT_ITEM_CODE — **스텝 축**. 한 스텝이 여러 코드를 갖는다
   * (도막 차수: S/P 는 S1~S6, T/UP 은 U1~U2).
   */
  elmtItemCodes: readonly string[]
  /** 대응하는 PNT_DETL_PRCS_NM — 툴팁·로그·대사용 (elmtItemCodes 와 같은 순서) */
  detailProcessNames: readonly string[]
}

/**
 * 유도된 매핑 — 현업 확정 시 여기만 바꾼다.
 *
 * ⚠️ 판단이 하나 들어갔다: **RE-S/P(`R0`)를 T/UP 에 귀속**시켰다. 이름은 S/P 계열이지만
 * 사양 시퀀스상 항상 `T/UP 뒤 · FINAL 앞`에 오고 13개 도장 사양 전부가 1회씩 갖는
 * 최종 보수 단계라, 순차 절점 모델에서는 T/UP 쪽이 순서 정합적이다. 이름 기준으로
 * 되돌리려면 아래 배열에서 'R0' 를 SP 로 옮기면 된다.
 */
export const PAINTING_STEP_MAPPING: Record<PaintingStepId, PaintingStepLegacyKey> = {
  SP: {
    pntWorkKind: PNT_WORK_KIND_PAINT,
    elmtItemCodes: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    detailProcessNames: ['S/P(1)', 'S/P(2)', 'S/P(3)', 'S/P(4)', 'S/P(5)', 'S/P(6)'],
  },
  TUP: {
    pntWorkKind: PNT_WORK_KIND_PAINT,
    elmtItemCodes: ['U1', 'U2', 'R0'],
    detailProcessNames: ['T/UP(1)', 'T/UP(2)', 'RE-S/P'],
  },
  FINAL: {
    pntWorkKind: PNT_WORK_KIND_PAINT,
    elmtItemCodes: ['Q0'],
    detailProcessNames: ['FINAL'],
  },
}

/**
 * 스텝이 아닌 **부대 작업** — 실데이터의 49.6%를 차지하며 절점 카드에 세지 않는다.
 * 알려진 부대 작업과 진짜 미분류(정합성 이슈)를 구분하기 위해 명시적으로 나열한다.
 */
export const PAINTING_ANCILLARY: readonly { pntWorkKind: string; elmtItemCode: string; name: string }[] =
  [
    { pntWorkKind: PNT_WORK_KIND_PAINT, elmtItemCode: 'T0', name: 'TAPE제거' },
    { pntWorkKind: PNT_WORK_KIND_PREP, elmtItemCode: 'R0', name: '작업준비' },
    { pntWorkKind: PNT_WORK_KIND_PREP, elmtItemCode: 'B0', name: '블라스팅' },
    { pntWorkKind: PNT_WORK_KIND_PREP, elmtItemCode: 'G0', name: 'GRIT수거' },
    { pntWorkKind: PNT_WORK_KIND_PREP, elmtItemCode: 'Q0', name: '검사' },
    { pntWorkKind: PNT_WORK_KIND_PREP, elmtItemCode: 'T0', name: 'TAPE설치' },
  ]

/** YPWP720M 한 행에서 판별에 쓰는 최소 컬럼 */
export interface PaintingRowKey {
  /** YPWP720M.PNT_WORK_KIND */
  pntWorkKind: string
  /** YPWP720M.ELMT_ITEM_CODE — `PNT_DETL_PRCS_CD` 끝 2자리와 같다 */
  elmtItemCode: string
}

/**
 * 행 분류 결과. `unknown` 은 **알려진 스텝도 부대 작업도 아닌** 조합이다 — 유도 시점
 * 3,996행에서는 0건이었으므로, 실연동에서 나오면 새 코드값이 생긴 것으로 보고
 * **완료 처리하지 않고 정합성 이슈로 올린다**(dataflow §6.1 불일치 노티와 같은 취급).
 */
export type PaintingRowClass =
  | { kind: 'step'; step: PaintingStepId }
  | { kind: 'ancillary'; name: string }
  | { kind: 'unknown' }

/** `PNT_DETL_PRCS_CD`(8자) → `ELMT_ITEM_CODE`(끝 2자) — 전건 검증된 합성 규칙의 역함수 */
export function elmtItemCodeOfDetailProcessCode(pntDetlPrcsCd: string): string {
  return pntDetlPrcsCd.slice(-2)
}

/** 행 하나를 스텝 / 부대 / 미분류로 가른다 */
export function classifyPaintingRow(row: PaintingRowKey): PaintingRowClass {
  for (const step of Object.keys(PAINTING_STEP_MAPPING) as PaintingStepId[]) {
    const key = PAINTING_STEP_MAPPING[step]
    if (row.pntWorkKind === key.pntWorkKind && key.elmtItemCodes.includes(row.elmtItemCode)) {
      return { kind: 'step', step }
    }
  }
  const ancillary = PAINTING_ANCILLARY.find(
    (a) => a.pntWorkKind === row.pntWorkKind && a.elmtItemCode === row.elmtItemCode
  )
  return ancillary ? { kind: 'ancillary', name: ancillary.name } : { kind: 'unknown' }
}

/** 스텝 행이면 스텝 ID, 아니면 null (부대·미분류를 구분해야 하면 classifyPaintingRow) */
export function paintingStepOf(row: PaintingRowKey): PaintingStepId | null {
  const cls = classifyPaintingRow(row)
  return cls.kind === 'step' ? cls.step : null
}
