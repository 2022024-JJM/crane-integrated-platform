import type { PaintingEquipmentKind } from '../model/equipment'

/*
 * 도장 설비 아이콘 — 맵 마커·범례·SCADA 설비 모듈 카드가 **같은 그림**을 쓴다.
 * 종류를 색이 아니라 그림으로도 말한다: 제습기 = 물방울, 가스히터 = 불꽃.
 */

export const DEHUMIDIFIER = '#3d82f0' // 제습기 = 파랑
export const DEHUMIDIFIER_DEEP = '#1d4fc0'
export const GAS_HEATER = '#e5533f' // 가스히터 = 빨강
export const GAS_HEATER_DEEP = '#b03023'

export function equipmentColor(kind: PaintingEquipmentKind): string {
  return kind === '가스히터' ? GAS_HEATER : DEHUMIDIFIER
}

export function equipmentDeepColor(kind: PaintingEquipmentKind): string {
  return kind === '가스히터' ? GAS_HEATER_DEEP : DEHUMIDIFIER_DEEP
}

/** 물방울/불꽃 글리프 — 색은 부모의 `currentColor` 를 따른다 */
export function EquipmentGlyph({ heater, size = 11 }: { heater: boolean; size?: number }) {
  return heater ? (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      {/* 불꽃 — 바깥 몸통과 안쪽 심지 두 겹으로 "타는 중" 인상 */}
      <path d="M6 .8c.4 1.6 1.3 2.5 2.2 3.5.9 1 1.5 2 1.5 3.2A3.7 3.7 0 0 1 6 11.2 3.7 3.7 0 0 1 2.3 7.5c0-1.7 1-2.6 1.7-3.9.3.7.6 1.2 1.2 1.6C5.4 4 5.8 2.4 6 .8z" />
      <path d="M6 6.2c.8.9 1.3 1.4 1.3 2.2A1.4 1.4 0 0 1 6 9.8a1.4 1.4 0 0 1-1.3-1.4c0-.8.5-1.3 1.3-2.2z" fill="rgba(255,255,255,0.55)" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      {/* 물방울 — 좌상단 하이라이트로 유리 느낌 */}
      <path d="M6 .9C7.9 3.4 9.6 5.3 9.6 7.4A3.6 3.6 0 0 1 6 11 3.6 3.6 0 0 1 2.4 7.4C2.4 5.3 4.1 3.4 6 .9z" />
      <circle cx="4.6" cy="6.6" r="1" fill="rgba(255,255,255,0.5)" />
    </svg>
  )
}

/**
 * 설비 칩 — 종류색 그라디언트 판 위 흰 글리프. 맵 범례와 SCADA 모듈 카드가 같은
 * 칩을 써서 "지도의 저 마커 = 목록의 이 카드"가 한눈에 이어진다.
 */
export function EquipmentChip({ kind, size = 18 }: { kind: PaintingEquipmentKind; size?: number }) {
  const heater = kind === '가스히터'
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-inshop-md border"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(180deg, ${equipmentColor(kind)} 0%, ${equipmentDeepColor(kind)} 100%)`,
        borderColor: 'rgba(255,255,255,0.4)',
        color: '#fff',
      }}
    >
      <EquipmentGlyph heater={heater} size={Math.round(size * 0.62)} />
    </span>
  )
}
