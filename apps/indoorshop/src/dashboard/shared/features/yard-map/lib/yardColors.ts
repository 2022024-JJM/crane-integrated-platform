import type { MapTheme } from './basemapStyle'
import { STATUS_HEX } from '../../../ui/statusPalette'

/**
 * 야드 맵에서 지번이 아닌 것들의 색.
 *
 * 지번 색은 `yardRepository.colorOfCategory()` 가 준다 — 레퍼런스 뷰어의 일곱 갈래
 * 배색을 그대로 쓰며, 현장이 이미 그 색으로 야드를 읽는다. 여기 있는 것은 그 위에
 * 얹히는 것들이라 **어떤 지번 색 위에서도 떠 보여야** 한다는 조건이 하나 더 붙는다.
 *
 * 베이스맵 밝기를 바꾸면 이 색들도 같이 바뀌어야 한다. 흰 글자는 밝은 지도 위에서
 * 사라지고, 밝은 경로색은 흰 길 위에서 사라진다 — **배경이 바뀌면 대비도 뒤집힌다.**
 */

export interface YardPalette {
  /** 지번 이름 */
  label: string
  /** 커서가 얹힌 지번의 테두리 */
  highlight: string
  /** 블록 점 — 어떤 지번 색 위에서도 튀어야 한다 */
  block: string
  /** 고른 블록 */
  blockSelected: string
  /** 블록 점 테두리 — 밝은 지번 위에서도 점이 떨어져 보이게 하는 한 겹 */
  blockOutline: string
  /** 고른 경로 아래에 까는 테 — 배경이 무엇이든 선이 끊겨 보이지 않게 한다 */
  moveHalo: string
  /** 계획은 아직 일어나지 않은 것이다 — 실적과 같은 채도를 주면 둘이 구별되지 않는다 */
  plan: string
  /**
   * 감시 대상 조립공장의 외곽 — **색을 쓰지 않는다.**
   * 상태는 그 안의 정반 채움이 말하므로, 공장선까지 색을 가지면 "공장 자체의 상태"라는
   * 없는 뜻이 생긴다. 명도만으로 "여기는 건물"이라고만 말한다.
   */
  shopHull: string
  /**
   * 공장 바닥판 — 정반을 얹기 전에 그 구역의 지번 색을 한 겹 눌러 두는 판이다.
   *
   * 야드 지번은 일곱 갈래 원색이라 공장 안팎이 똑같이 알록달록하다. 그 위에 정반 색을
   * 얹으면 **색이 하나 더 늘 뿐 구역으로 읽히지 않는다.** 아래를 눌러 두면 같은 정반
   * 색이 훨씬 진하게 서고, 눈이 "여기부터 여기까지가 한 공장"을 먼저 잡는다.
   * 그래서 이 값은 색이 아니라 중성(무채색)이어야 한다 — 색을 쓰면 뜻이 생긴다.
   */
  shopPlate: string
  /** 정반 상태 채움 — 조립 화면의 상태 삼분(가동/미확인/공석)과 같은 뜻을 쓴다 */
  bayOccupied: string
  bayUnknown: string
  bayEmpty: string
  /** 정반·공장 테두리 아래에 까는 한 겹 — 어떤 지번 색 위에서도 경계가 살아남게 한다 */
  bayOutline: string
  /**
   * 이동 경로 색 — 하루치 경로를 서로 갈라 보이게 하는 것이 유일한 목적이라,
   * 색 자체에 뜻은 없다(순서대로 돌려 쓴다).
   */
  moves: readonly string[]
}

export const YARD_PALETTES: Record<MapTheme, YardPalette> = {
  dark: {
    label: 'rgba(238, 242, 247, 0.82)',
    highlight: '#ffffff',
    block: '#ffa347',
    blockSelected: '#ffffff',
    blockOutline: 'rgba(10, 14, 19, 0.9)',
    moveHalo: 'rgba(255, 255, 255, 0.85)',
    plan: '#8aa4bd',
    shopHull: 'rgba(238, 242, 247, 0.92)',
    /* 어두운 바탕에서는 더 어둡게 눌러야 지번 색이 가라앉는다 */
    shopPlate: 'rgba(6, 10, 15, 0.62)',
    /* 상태 팔레트(STATUS_HEX.dark)와 같은 값 — 3D 화면·목록·맵이 같은 상태를 같은 색으로 말한다.
     * 재실은 **작업이 도는 중**이라 진행중(파랑)이다. 예전에는 초록이라 통합실적의
     * 완료(초록)와 같은 색이었고, 화면을 건너면 뜻이 뒤집혔다(감사 F-6). */
    bayOccupied: STATUS_HEX.dark.inProgress,
    bayUnknown: STATUS_HEX.dark.warning,
    /*
     * 아래 두 색은 **불투명하다** — 옅게 깔지 여부는 그리는 쪽(globalAlpha)이 정한다.
     * 색에도 알파를 넣으면 두 알파가 곱해져서, 값을 만질 때마다 결과를 예측할 수 없다.
     * 공석은 뜻이 없는 색이어야 하므로 중립 회색이다 (상태색을 재사용하지 않는다).
     */
    bayEmpty: STATUS_HEX.dark.idle,
    bayOutline: 'rgb(10, 14, 19)',
    /* 어두운 바탕 위라 명도를 높였다 */
    moves: ['#ff6b6b', '#4dabf7', '#b197fc', '#38d9a9', '#ffd43b', '#748ffc', '#f783ac', '#63e6be'],
  },
  light: {
    label: 'rgba(28, 34, 42, 0.88)',
    highlight: '#1a1f26',
    block: '#f4801f',
    blockSelected: '#16202b',
    blockOutline: 'rgba(24, 20, 14, 0.85)',
    moveHalo: 'rgba(255, 255, 255, 0.9)',
    plan: '#5b7186',
    shopHull: 'rgba(26, 31, 38, 0.88)',
    /*
     * 밝은 바탕에서는 **어둡게** 눌러야 한다 — 하얗게 덮으면 지번 색이 옅어질 뿐
     * 판으로 보이지 않아서, 공장 구역이 그냥 바랜 자리처럼 읽힌다.
     */
    shopPlate: 'rgba(32, 39, 48, 0.2)',
    /*
     * 밝은 지도 위에서는 앱의 라이트 상태색을 그대로 쓸 수 없다 — 주의색(#7a5b00)은
     * 베이지 건물 위에서 흙색으로 묻힌다. **색상(hue)은 팔레트를 따르고 채도만** 올린다.
     * 재실이 파랑인 이유는 다크와 같다(감사 F-6 — 작업중은 어디서나 파랑).
     */
    bayOccupied: STATUS_HEX.light.inProgress,
    bayUnknown: '#a9760a',
    bayEmpty: STATUS_HEX.light.idle,
    bayOutline: 'rgb(255, 255, 255)',
    /* 밝은 바탕 위라 채도를 올리고 명도를 낮췄다 — 레퍼런스 뷰어의 배색이다 */
    moves: ['#e34948', '#2a78d6', '#8e5fa8', '#0e8088', '#d98a1f', '#454fa0', '#c2185b', '#00796b'],
  },
}

export function paletteOf(theme: MapTheme): YardPalette {
  return YARD_PALETTES[theme]
}

export function moveColor(index: number, theme: MapTheme): string {
  const colors = YARD_PALETTES[theme].moves
  return colors[index % colors.length]
}

/** 정반 상태 → 채움색. 맵·범례가 같은 함수를 쓰므로 둘이 어긋날 수 없다 */
export function bayColor(status: 'occupied' | 'empty' | 'unknown', palette: YardPalette): string {
  if (status === 'occupied') return palette.bayOccupied
  if (status === 'unknown') return palette.bayUnknown
  return palette.bayEmpty
}
