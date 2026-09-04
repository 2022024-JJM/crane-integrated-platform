import type { LatLon } from '../../../entities/yard-parcels'
import { planarOf } from './projection'
import { bayFrameOf } from './blueprint'

/*
 * ── 도면 회전 (R42) ──
 *
 * 옥포의 공장은 해안선을 따라 앉아 있어 베이가 20~40° 기울어 있다. 북쪽을 위로 고정해
 * 그리면 칸이 전부 마름모가 되고, 그 안에 설비 줄을 아무리 반듯이 세워도 그림은 사선
 * 무늬로 읽힌다 — 배치도는 늘 건물 축을 종이 축에 맞춰 그린다.
 *
 * 그래서 **베이들에게 각도를 물어** 세계를 그만큼 되돌린다. 방위(북쪽이 위)를 잃지만,
 * 이 그림이 답하는 질문은 "어느 칸 몇 번째 자리냐" 이지 "어느 방향이냐" 가 아니다
 * (방위가 필요한 화면은 야드 지도다 — 거기는 북쪽이 위로 남는다).
 *
 * 각도를 어떻게 하나로 접는가:
 *  · 방향이 아니라 **축**이다. 0° 로 누운 베이와 180° 로 누운 베이는 같은 자세이므로,
 *    각을 두 배로 늘려 평균한 뒤 반으로 되돌린다(축 자료의 원형 평균). 그냥 산술평균을
 *    쓰면 179° 와 1° 의 평균이 90° 가 되어, 나란한 베이 둘이 직각으로 어긋난다.
 *  · **큰 칸이 이긴다.** 넓이로 가중한다 — 구석의 작은 칸 하나가 공장 전체를 돌리면
 *    안 된다.
 *  · **정사각에 가까운 칸은 말을 아낀다.** 가로세로가 같은 칸에는 '장변' 이 없다 —
 *    최소면적 직사각형이 두 직각 방향 중 아무 쪽이나 고르므로, 그 각을 곧이곧대로
 *    평균에 넣으면 나란한 칸들이 정한 자세를 정사각 칸 몇 개가 흔든다(느태 도장공장이
 *    그랬다: 33° 틀어져 전부 마름모가 됐다). 그래서 넓이에 **길쭉함**을 곱해 가중한다.
 */

/** 회전각을 물을 베이 하나 — 껍질만 있으면 된다 */
export interface OrientedBay {
  hull: readonly LatLon[]
}

/**
 * 이 공장의 도면 회전각(라디안).
 *
 * 베이 장변이 가로로 서게 하는 값이며, 투영이 이 각만큼 세계를 되돌린다. 베이가 없으면
 * 0 — 돌릴 근거가 없으면 돌리지 않는다(설비 점만 있는 공장에서 임의로 기울이지 않는다).
 */
export function birdviewRotationOf(bays: readonly OrientedBay[]): number {
  let sumCos = 0
  let sumSin = 0
  for (const bay of bays) {
    const frame = bayFrameOf(bay.hull.map(planarOf))
    if (!frame) continue
    /*
     * 넓이 × 길쭉함 — 큰 칸이 정하되, 자세를 말할 자격이 있는 칸만 말한다.
     * 길쭉함은 0(정사각)~1(선분)이라 정사각 칸은 자연히 표를 잃는다.
     */
    const elongation = (frame.halfU - frame.halfV) / (frame.halfU + frame.halfV)
    const weight = frame.halfU * frame.halfV * elongation
    if (!(weight > 0)) continue
    const angle = Math.atan2(frame.uy, frame.ux)
    sumCos += weight * Math.cos(2 * angle)
    sumSin += weight * Math.sin(2 * angle)
  }
  if (sumCos === 0 && sumSin === 0) return 0
  return Math.atan2(sumSin, sumCos) / 2
}

