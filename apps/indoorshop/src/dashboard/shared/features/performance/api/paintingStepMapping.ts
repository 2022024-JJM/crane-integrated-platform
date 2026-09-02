import type { PaintingStepId } from '../model/types'

/*
 * 도장 스텝 ↔ 레거시 키 잠정 매핑 — **현업 확정 시 이 파일만 수정한다.**
 *
 * 화면 스텝(S/P → T/UP → FINAL)은 YPWP720M 의 블록×공종×차수 키(PNT_WORK_KIND ·
 * PNT_SEQ)에 대응하는 것으로 보이나, 코드값은 추정 명세(SE12 검증 전)라 잠정이다
 * (사용자 게이트 결정: 추정 그대로 진행하되 변경 가능한 형태로 한 곳에 모은다).
 * mock 생성기·실연동 쿼리 모두 이 표만 경유해야 하며, 스텝을 하드코딩으로 흩뜨리지
 * 않는다.
 */
export interface PaintingStepLegacyKey {
  /** YPWP720M.PNT_WORK_KIND — 잠정 (P=본도장? F=FINAL? — 현업 확인 전) */
  pntWorkKind: string
  /** YPWP720M.PNT_SEQ — 차수, 잠정 */
  pntSeq: string
}

/** 잠정 매핑 — 현업 확정 시 여기만 바꾼다 */
export const PAINTING_STEP_MAPPING: Record<PaintingStepId, PaintingStepLegacyKey> = {
  SP: { pntWorkKind: 'P', pntSeq: '01' },
  TUP: { pntWorkKind: 'P', pntSeq: '02' },
  FINAL: { pntWorkKind: 'F', pntSeq: '01' },
}
