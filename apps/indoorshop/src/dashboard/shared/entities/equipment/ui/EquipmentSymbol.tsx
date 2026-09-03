import { equipmentTypeOf } from '..'
import { cn } from '../../../lib/utils'

/*
 * 설비 종류 픽토그램 — 지도 마커·목록·범례가 **같은 그림**을 쓴다.
 *
 * 심볼 이름은 원본 종류 레지스트리(`equipment-types.js` 의 `심볼` 열)가 정한다:
 *   vent(제습기) / flame(히터) / plc(제어반) / hub(네트워크) / lidar / cam / rfid /
 *   tilt(팬틸트) / server(PC류) / panel(캐비닛) / gear(기타) / box(단순 상자)
 * 종류를 **색만으로** 말하지 않는 이유는 도장 SCADA 와 같다 — 색각 이상·흑백에서
 * 정보가 사라지지 않게 그림이 한 번 더 말한다.
 *
 * ⚠️ 도장(DH/GH)은 이미 자기 아이콘 문법(`processes/painting/ui/equipmentIcon`)을 갖고
 * 있고 SCADA 화면이 그것을 쓴다 — 여기서 갈아치우지 않는다. 이 컴포넌트는 지도·설비
 * 인벤토리처럼 **모든 종류를 한 자리에 세우는** 화면의 몫이며, vent/flame 도 같은 뜻의
 * 그림으로 갖춰 두어 한 목록 안에서 문법이 끊기지 않게 한다.
 *
 * ⚠️ `rfid` 글리프가 있는 것은 레지스트리에 종류가 남아 있기 때문이다 — 인벤토리에
 * 그리기 위한 그림일 뿐, RFID 수집 경로를 되살리는 것이 아니다(폐기된 아키텍처).
 */

/** 레지스트리가 쓰는 심볼 이름 */
export type EquipmentSymbolName =
  | 'vent'
  | 'flame'
  | 'plc'
  | 'hub'
  | 'lidar'
  | 'cam'
  | 'rfid'
  | 'tilt'
  | 'server'
  | 'panel'
  | 'gear'
  | 'box'

/** 12×12 좌표계 글리프 — 색은 부모의 `currentColor` 를 따른다 */
const GLYPHS: Record<EquipmentSymbolName, React.ReactNode> = {
  // 물방울 — 제습
  vent: <path d="M6 .9C7.9 3.4 9.6 5.3 9.6 7.4A3.6 3.6 0 0 1 6 11 3.6 3.6 0 0 1 2.4 7.4C2.4 5.3 4.1 3.4 6 .9z" fill="currentColor" />,
  // 불꽃 — 가열
  flame: <path d="M6 .8c.4 1.6 1.3 2.5 2.2 3.5.9 1 1.5 2 1.5 3.2A3.7 3.7 0 0 1 6 11.2 3.7 3.7 0 0 1 2.3 7.5c0-1.7 1-2.6 1.7-3.9.3.7.6 1.2 1.2 1.6C5.4 4 5.8 2.4 6 .8z" fill="currentColor" />,
  // 제어반 — 스위치가 달린 판
  plc: (
    <>
      <rect x="1.6" y="2" width="8.8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.8 4.3v3.4M6 4.3v3.4M8.2 4.3v3.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  // 네트워크 허브 — 한 점에서 갈라지는 포트
  hub: (
    <>
      <rect x="1.4" y="6.6" width="9.2" height="3.6" rx="0.9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 1.6v3.2M6 4.8 3.2 6.6M6 4.8l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  // 라이다 — 회전 스캔 부챗살
  lidar: (
    <>
      <circle cx="6" cy="7.2" r="1.7" fill="currentColor" />
      <path d="M2.4 4.6a4.7 4.7 0 0 1 7.2 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.9 6.2a2.9 2.9 0 0 1 4.2 0" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.65" />
    </>
  ),
  // 카메라 — 몸통과 렌즈
  cam: (
    <>
      <rect x="1.4" y="3.4" width="7.4" height="5.4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.8 5.6 10.8 4.3v3.6L8.8 6.6z" fill="currentColor" />
    </>
  ),
  // RFID — 태그와 전파
  rfid: (
    <>
      <rect x="1.4" y="4" width="5" height="4.4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.6 4.2a3.2 3.2 0 0 1 0 4M9.4 2.9a5.2 5.2 0 0 1 0 6.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  // 팬틸트 — 받침 위에서 도는 머리
  tilt: (
    <>
      <path d="M2.2 9.6h7.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 9.6V7.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3.4" y="3.4" width="5.2" height="3.8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.2 2.6a5.4 5.4 0 0 1 3-1.4" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  // 서버/PC — 두 단 랙
  server: (
    <>
      <rect x="1.6" y="2.2" width="8.8" height="3.4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.6" y="6.6" width="8.8" height="3.4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3.5" cy="3.9" r="0.7" fill="currentColor" />
      <circle cx="3.5" cy="8.3" r="0.7" fill="currentColor" />
    </>
  ),
  // 캐비닛 — 문 두 짝과 손잡이
  panel: (
    <>
      <rect x="1.8" y="1.6" width="8.4" height="8.8" rx="0.9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 1.6v8.8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.9 5.6v1.2M7.1 5.6v1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  // 톱니 — 기타
  gear: (
    <>
      <circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 1.2v1.6M6 9.2v1.6M1.2 6h1.6M9.2 6h1.6M2.6 2.6l1.1 1.1M8.3 8.3l1.1 1.1M9.4 2.6 8.3 3.7M3.7 8.3 2.6 9.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  ),
  // 상자 — 단순 기기
  box: <rect x="2" y="2.6" width="8" height="6.8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />,
}

const FALLBACK: EquipmentSymbolName = 'gear'

/** 심볼 이름이 우리가 아는 12종인가 — 모르는 이름은 톱니로 떨어뜨린다(빈칸으로 두지 않는다) */
export function symbolNameOf(raw: string): EquipmentSymbolName {
  return raw in GLYPHS ? (raw as EquipmentSymbolName) : FALLBACK
}

/** 종류ID → 심볼 이름 (레지스트리 경유) */
export function symbolOfType(typeId: string): EquipmentSymbolName {
  const type = equipmentTypeOf(typeId)
  return type ? symbolNameOf(type.symbol) : FALLBACK
}

/** 종류ID → 표시색 (레지스트리가 단일 소스 — 화면에서 색을 새로 정하지 않는다) */
export function colorOfType(typeId: string): string {
  return equipmentTypeOf(typeId)?.color ?? '#7a8794'
}

/** 글리프만 — 색은 부모가 준다 */
export function EquipmentGlyph({
  symbol,
  size = 12,
  className,
}: {
  symbol: EquipmentSymbolName
  size?: number
  className?: string
}) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true" className={className}>
      {GLYPHS[symbol]}
    </svg>
  )
}

/**
 * 종류 칩 — 종류색 판 위 흰 글리프.
 * 지도 마커·목록 머리·범례가 같은 칩을 써서 "지도의 저 표시 = 목록의 이 줄"이 이어진다.
 */
export function EquipmentSymbolChip({
  typeId,
  size = 18,
  dim = false,
  className,
}: {
  typeId: string
  size?: number
  /** 꺼진(오프라인) 표현 — 채움을 비우고 테두리만 남긴다 */
  dim?: boolean
  className?: string
}) {
  const color = colorOfType(typeId)
  const symbol = symbolOfType(typeId)
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-inshop-md border', className)}
      style={{
        width: size,
        height: size,
        background: dim ? 'transparent' : color,
        borderColor: dim ? color : 'rgba(255,255,255,0.42)',
        color: dim ? color : '#fff',
      }}
    >
      <EquipmentGlyph symbol={symbol} size={Math.round(size * 0.66)} />
    </span>
  )
}
