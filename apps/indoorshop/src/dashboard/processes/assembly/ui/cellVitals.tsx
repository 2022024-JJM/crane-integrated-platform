import { AimDial } from '../../../shared/ui/atoms/AimDial'
import { CellLamp, type EquipmentLamp } from '../../../shared/features/equipment-grid'
import type { LinkState, TiltModuleStatus } from '../../../shared/entities/equipment'
import { meaningOfTiltMode, TILT_MODE_TEXT } from '../lib/equipmentCells'

/*
 * 조립 셀의 **활력 지표** — 그리드 셀 둘째 줄 앞머리에 서는 그림.
 *
 * ── 왜 램프를 골라 세우는가 ──
 *
 * 셀의 램프 배열은 지도 카드가 그대로 읽는 **전체 명세**다. 그런데 칸은 카드가 아니다:
 * 한 화면에 57칸이 서고, 칸마다 램프 셋이 다 서면 색을 가진 것이 칸당 넷이 된다
 * (종류칩 · 링크점 · 다이얼 · 신선도). 57칸이 전부 초록이면 그 초록은 아무 뜻도 나르지
 * 않고, 정작 붉어야 할 한 칸이 그 초록 벽에 묻힌다 — ISA-101 이 경계하는 바로 그 상태다.
 *
 * 그래서 칸에는 **수치 자리가 말하지 못하는 것만** 세운다:
 *  · **링크는 세우지 않는다.** 끊기면 수치 자리가 이미 사유를 말한다("오프라인 · 21분 전",
 *    "통신 오류 · 3분 전") — 앰버·빨강으로, 테두리와 정렬까지 함께. 링크 램프가 더할 것이
 *    없다. 살아 있을 때도 마찬가지다: 경과가 흐르고 있다는 사실 자체가 링크의 증거다.
 *  · **나머지는 세운다.** MQTT·수집 컨테이너·전원·소속 대수는 링크가 살아 있어도 따로
 *    나빠질 수 있어, 수치 자리가 대신 말해 주지 못한다.
 *
 * 지도 카드는 여전히 램프 전부를 낸다 — 거기서는 한 대를 들여다보는 중이라 다 적어야 한다.
 * "카드는 전부, 칸은 수치가 말하지 못하는 것만" 이 이 파일의 한 줄 요약이다.
 *
 * ── 라이다는 왜 다이얼인가 ──
 *
 * 라이다 칸이 오래도록 익명 점 셋(`● ● ●`)과 벌거벗은 숫자 쌍(`-80°/-9°`)이었다. 점 셋의
 * 뜻은 화면 어디에도 적혀 있지 않았고(툴팁에만 있었는데, 수십 칸을 훑는 눈은 툴팁을 열지
 * 않는다), 숫자 쌍은 **방향**인데 방향으로 보이지 않았다. 방위는 그림으로 아는 값이다.
 *
 * 이 파일은 `lib/equipmentCells.ts` 가 순수하게 남도록 **JSX 만** 맡는다 — 셀을 만드는
 * 규칙은 여전히 lib 에 있고(검증 가능해야 한다), 그리는 일만 여기로 나온다.
 */

/** 칸에 세울 램프만 골라 이름과 함께 — 링크는 수치 자리의 몫이라 늘 뺀다 */
function cellLamps(lamps: readonly EquipmentLamp[]): EquipmentLamp[] {
  return lamps.filter((lamp) => lamp.label !== '링크')
}

/** 라이다-틸팅 페어 한 칸의 활력 — 조준 다이얼 하나 */
export function LidarVitals({
  tilt,
  glass = false,
}: {
  link: LinkState
  tilt: TiltModuleStatus | null
  glass?: boolean
}) {
  if (!tilt) {
    /* 짝이 없으면 자세를 말할 것이 없다 — 빈 다이얼을 그려 없는 값을 지어내지 않는다 */
    return <CellLamp lamp={{ label: '틸팅', meaning: 'idle', value: '짝 없음' }} glass={glass} named />
  }
  return (
    <AimDial
      panDeg={tilt.panDeg}
      tiltDeg={tilt.tiltDeg}
      target={tilt.atTarget ? null : { panDeg: tilt.targetPanDeg, tiltDeg: tilt.targetTiltDeg }}
      meaning={meaningOfTiltMode(tilt.mode)}
      glass={glass}
      label={aimLabel(tilt)}
    />
  )
}

/** Edge PC·캐비닛 한 칸의 활력 — 이름 붙은 램프. 종류마다 램프 뜻이 달라 이름이 붙는다 */
export function LampVitals({
  lamps,
  glass = false,
}: {
  lamps: readonly EquipmentLamp[]
  glass?: boolean
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {cellLamps(lamps).map((lamp) => (
        <CellLamp key={lamp.label} lamp={lamp} glass={glass} named />
      ))}
    </span>
  )
}

/** 다이얼의 접근성 이름 — 그림을 못 읽는 경로에는 이 말이 전부다 */
export function aimLabel(tilt: TiltModuleStatus): string {
  const head = `틸팅 ${TILT_MODE_TEXT[tilt.mode]} · 방위 ${tilt.panDeg}도 · 고도 ${tilt.tiltDeg}도`
  return tilt.atTarget ? head : `${head} · 목표 ${tilt.targetPanDeg}도 ${tilt.targetTiltDeg}도`
}
