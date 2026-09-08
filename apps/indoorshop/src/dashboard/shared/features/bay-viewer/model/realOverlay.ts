/*
 * 실측 스캔 오버레이 데이터 계약 — 뷰어가 받는 다운샘플 점군의 모양.
 *
 * 생성(다운샘플·벽선 앵커)은 공정 데이터 계층의 몫이다(조립은
 * `processes/assembly/api/realScanData`). 뷰어는 이 모양만 알고, 어느 공정의 실측인지
 * 모른다 — `BaySceneData.realScan` 플래그와 함께 온다.
 */

/** 실측 라이다 한 대의 자리 — 점군과 **같은 프레임**이라 별도 정합이 없다 */
export interface RealScanSensorPlacement {
  /**
   * 센서 이름(장비 IP) — `LidarSensor.name` 과 같은 값이다. 마커를 상태 목록에
   * 붙일 때 **인덱스가 아니라 이름으로** 맞춘다(두 목록의 순서를 가정하지 않는다).
   */
  name: string
  /** 베이 로컬 [x, y(높이), z] — `positions` 와 같은 변환을 거친 값 */
  position: [number, number, number]
}

export interface RealScanOverlay {
  /**
   * 베이 로컬(xyz, y=높이) — **베이 상자 중심이 원점**이고 +z 가 베이 길이 방향이다.
   * (예전처럼 점군 도심으로 재중심하지 않는다 — 실형상 배치의 베이 상자가 실제 치수라
   *  "베이 안 어느 구간인가"를 앵커가 그대로 싣는다.)
   */
  positions: Float32Array
  /** 점별 의사 반사강도(0..255) — 없으면 null (단색으로 그린다) */
  shade: Uint8Array | null
  /**
   * 실측 센서 자리 — manifest 의 실측 좌표를 `positions` 와 **같은 변환**으로 옮긴 것.
   * 설비 도면의 LiDAR 좌표(`BayLayout.sensorPoints`)를 대신 쓰지 않는다: 실측 12대
   * (갠트리 3기)와 도면 12대(베이 전장 32m 피치)는 서로 다른 장비 집합이라
   * 실측 점군 위에 도면 자리를 얹으면 화면이 거짓말한다 (W5-3 분석 §A③).
   */
  sensors: RealScanSensorPlacement[]
  /** 유도한 벽면간 내부 폭(m) — 앵커 판정 근거 */
  innerWidth: number
  /** 그 폭 ÷ 도면 베이 단변 — 게이트가 본 값 (1 에 가까울수록 좋다) */
  widthRatio: number
}
