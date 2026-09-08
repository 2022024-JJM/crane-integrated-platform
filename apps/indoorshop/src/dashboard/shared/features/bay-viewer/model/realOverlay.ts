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
   * 점별 **블록 라벨** — 0..n = 정합된 블록의 인덱스, 254 = 베이 바닥, 255 = 미정합.
   * 베이 진입 뷰가 쓰는 라벨의 같은 표본이라, 두 화면이 같은 덩이를 같은 색으로 세운다.
   * 없으면 null — 그때는 예전처럼 음영 단색으로만 그린다.
   */
  labels: Uint8Array | null
  /** `labels` 가 가리키는 블록 이름 — 인덱스 순서. 범례·툴팁이 색과 이름을 잇는다 */
  blockNames: readonly string[]
  /**
   * 점별 **CAD 표면 편차**(0..255, 255 = 미일치) — 라벨의 임계 재판정에 쓴다.
   *
   * 라벨은 자산 생성 시점의 허용오차(`toleranceM`)로 붙어 있고, 화면이 쓰는 임계는
   * 그보다 빡빡할 수 있다. 이 배열이 없으면 공장 뷰가 베이 진입 뷰보다 **더 많은 점을
   * 블록색으로 칠하게 되어**(현 데이터 +14%) 같은 덩이를 두 화면이 다른 크기로 말한다.
   */
  dev: Uint8Array | null
  /** 라벨이 붙은 기준 허용오차(m) — 화면 임계를 편차 컷오프로 바꾸는 분모 */
  toleranceM: number
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
