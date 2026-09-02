/*
 * 실측 스캔 오버레이 데이터 계약 — 뷰어가 받는 다운샘플 점군의 모양.
 *
 * 생성(다운샘플·센서 정합 앵커)은 공정 데이터 계층의 몫이다(조립은
 * `processes/assembly/api/realScanData`). 뷰어는 이 모양만 알고, 어느 공정의 실측인지
 * 모른다 — `BaySceneData.realScan` 플래그와 함께 온다.
 */
export interface RealScanOverlay {
  /** 베이 로컬(xyz, y=높이) — 도심 재중심 완료, 목업 베이 상자 원점 기준 */
  positions: Float32Array
  /** 점별 의사 반사강도(0..255) — 없으면 null (단색으로 그린다) */
  shade: Uint8Array | null
  /** 센서 정합 잔차(m) — 화면 판정 근거 */
  rms: number
}
