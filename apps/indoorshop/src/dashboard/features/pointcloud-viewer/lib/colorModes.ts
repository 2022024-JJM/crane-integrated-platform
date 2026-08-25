import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { ViewerDisplayMode } from './displayModes'

/*
 * 색상 규칙의 **선택지와 전환 규칙**만 담는다 (three 비의존).
 * 실제 색칠(applyPointColors)은 three 가 필요하므로 pointColorRules 에 남겨,
 * 컨트롤·페이지가 3D 번들을 끌어오지 않게 한다.
 */

export type PointColorMode = 'sensor' | 'height' | 'object' | 'progress' | 'plain'

export interface ColorModeOption {
  value: PointColorMode
  labelKey: InshopKey
  descriptionKey: InshopKey
}

/** 점군 계열 표시 모드(점군·겹쳐보기)에서 고를 수 있는 규칙 */
export const PCD_COLOR_MODES: ColorModeOption[] = [
  { value: 'sensor', labelKey: 'viewer.color.sensor', descriptionKey: 'viewer.color.sensorDescription' },
  { value: 'height', labelKey: 'viewer.color.height', descriptionKey: 'viewer.color.heightDescription' },
  { value: 'object', labelKey: 'viewer.color.object', descriptionKey: 'viewer.color.objectDescription' },
  {
    value: 'progress',
    labelKey: 'viewer.color.progress',
    descriptionKey: 'viewer.color.progressDescription',
  },
]

/** CAD 표시 모드에서 고를 수 있는 규칙 — 점군 규칙은 의미가 없다 */
export const CAD_COLOR_MODES: ColorModeOption[] = [
  { value: 'plain', labelKey: 'viewer.color.plain', descriptionKey: 'viewer.color.plainDescription' },
  {
    value: 'progress',
    labelKey: 'viewer.color.progress',
    descriptionKey: 'viewer.color.progressDescription',
  },
]

export function colorModesFor(mode: ViewerDisplayMode): ColorModeOption[] {
  return mode === 'cad' ? CAD_COLOR_MODES : PCD_COLOR_MODES
}

/**
 * 표시 모드가 바뀔 때의 색상 규칙 전환.
 * CAD 로 들어가면 점군 규칙은 의미가 없으므로 `도면`으로 바꾸고, 나올 때 쓰던 규칙으로
 * 되돌린다. `진척`은 양쪽에서 유효하므로 그대로 유지한다.
 */
export function reconcileColorMode(
  next: ViewerDisplayMode,
  current: PointColorMode,
  remembered: PointColorMode
): PointColorMode {
  const allowed = colorModesFor(next).map((o) => o.value)
  if (allowed.includes(current)) return current
  return next === 'cad' ? 'plain' : allowed.includes(remembered) ? remembered : 'sensor'
}

