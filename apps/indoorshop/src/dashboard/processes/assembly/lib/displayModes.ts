import type { InshopKey } from '../../../shared/lib/i18n/keys'

/**
 * 뷰어 표시 모드와 모드별 팔레트.
 *
 * 어두운 점군 뷰포트에 회색 솔리드만 얹으면 도면으로 읽히지 않는다.
 * 배경·조명·윤곽 색을 함께 바꿔야 CAD 뷰어처럼 보이므로, 모드마다
 * 씬 전체의 색 환경을 하나의 묶음으로 정의한다.
 */
export type ViewerDisplayMode = 'pcd' | 'cad' | 'overlay'

export interface DisplayModeOption {
  value: ViewerDisplayMode
  labelKey: InshopKey
  descriptionKey: InshopKey
}

export const DISPLAY_MODES: DisplayModeOption[] = [
  { value: 'pcd', labelKey: 'viewer.display.pcd', descriptionKey: 'viewer.display.pcdDescription' },
  { value: 'cad', labelKey: 'viewer.display.cad', descriptionKey: 'viewer.display.cadDescription' },
  {
    value: 'overlay',
    labelKey: 'viewer.display.overlay',
    descriptionKey: 'viewer.display.overlayDescription',
  },
]

/** 모드별 씬 색 환경 */
export interface ViewPalette {
  /** 뷰포트 배경 (아래쪽) */
  background: number
  /**
   * 배경 위쪽 색. `background` 와 다르면 위아래 그라디언트로 깔린다 —
   * 완전한 단색 바탕에서는 점군이 허공에 뜬 것처럼 보여 깊이가 안 읽힌다.
   */
  backgroundTop: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  dirIntensity: number
  /** CAD 솔리드 */
  cadColor: number
  cadOpacity: number
  cadDepthWrite: boolean
  /** CAD 특징선 */
  edgeColor: number
  edgeOpacity: number
  /** 베이 경계선 (실측 뷰에서는 바닥 구획 도색) */
  boundaryColor: number
  /** 베이 구획 내부 면 — 영역으로 읽히되 점군을 가리지 않을 만큼만 */
  boundaryFillOpacity: number
  /**
   * 바닥으로 분류된 점 색. 바닥까지 같은 규칙으로 칠하면 화면 절반이 한 덩어리가
   * 돼 조립품이 안 뜬다 — 어떤 규칙에서든 바닥은 이 색으로 눌러 깐다.
   */
  floorPointColor: number
  /** 거리 안개 (배경색으로 수렴) — 100m 홀에서 원근이 안 읽히는 것을 막는다 */
  fogColor: number
  /** 바닥 그리드 (CAD 모드에서만 그린다) */
  gridColor: number
  gridOpacity: number
}

/**
 * 점군 뷰 — 어두운 배경에서 점의 채도가 살아난다.
 * 다만 새까맣게 두면 바닥과 허공의 구분이 사라지므로, 위를 살짝 들어 올린
 * 스튜디오 배경으로 깔고 바닥 그리드를 옅게 남긴다.
 */
export const PCD_VIEW: ViewPalette = {
  background: 0x12171d,
  backgroundTop: 0x263039,
  hemiSky: 0xdde6f0,
  hemiGround: 0x1a2030,
  hemiIntensity: 1.1,
  dirIntensity: 0.9,
  cadColor: 0xfbbf24,
  cadOpacity: 0.28,
  cadDepthWrite: false,
  edgeColor: 0xfbbf24,
  edgeOpacity: 0.5,
  boundaryColor: 0x7fb2d8,
  boundaryFillOpacity: 0.09,
  floorPointColor: 0x39434f,
  fogColor: 0x12171d,
  gridColor: 0x2f3d4c,
  gridOpacity: 0.5,
}

/** CAD 뷰 — 밝은 중성 회색 배경 + 무채색 솔리드 + 진한 특징선 */
export const CAD_VIEW: ViewPalette = {
  background: 0xd9dbdd,
  backgroundTop: 0xeceef0,
  hemiSky: 0xffffff,
  hemiGround: 0xb8bcc0,
  hemiIntensity: 1.5,
  dirIntensity: 1.0,
  cadColor: 0xf2f3f4,
  cadOpacity: 1,
  cadDepthWrite: true,
  edgeColor: 0x2f3438,
  edgeOpacity: 0.85,
  boundaryColor: 0x7a848c,
  boundaryFillOpacity: 0.07,
  floorPointColor: 0xb9bec3,
  fogColor: 0xd9dbdd,
  gridColor: 0xa8adb2,
  gridOpacity: 0.9,
}

/** 겹쳐보기 — 점군 환경을 쓰되 도면을 더 흐리게 얹는다 */
export const OVERLAY_VIEW: ViewPalette = {
  ...PCD_VIEW,
  cadOpacity: 0.2,
}

/**
 * 이 표시 모드에서 쓸 색 환경.
 *
 * 앱 테마는 타지 않는다 — 3D 바탕은 점 채도를 살리려고 두 테마 모두 어둡게 고정하고
 * (globals.css 의 `--viewport` 주석과 같은 이유), 밝기를 정하는 것은 표시 모드다.
 */
export function paletteFor(mode: ViewerDisplayMode): ViewPalette {
  if (mode === 'cad') return CAD_VIEW
  if (mode === 'overlay') return OVERLAY_VIEW
  return PCD_VIEW
}

/**
 * `CAD 정합` 규칙에서 색을 갖지 않는 점들 — 정합점만 색으로 뜨게 하려면 나머지는
 * 무채색이어야 한다. 바닥은 점의 40% 가까이 되므로 한 단 눌러 깐다.
 * (점과 범례가 같은 색을 말해야 하므로 값은 여기 한 곳에만 둔다.)
 */
export const MATCH_NEUTRALS = { rest: '#d7dce3', floor: '#767f8b' } as const

/**
 * 뷰포트의 **윗모서리에 붙는 UI**(3D 상자에 얹힌 탭)가 입어야 할 색.
 *
 * 붙어 있는 것으로 읽히려면 탭이 상자와 같은 색이어야 하는데, 그 색은 **표시 모드**가
 * 정한다 — CAD 뷰는 밝은 회색 바탕이라, 어두운 점군 뷰의 색을 그대로 입으면 탭만
 * 남의 창에서 떨어져 나온 것처럼 보인다.
 */
export function viewportEdgeColors(mode: ViewerDisplayMode): {
  background: string
  foreground: string
} {
  const palette = paletteFor(mode)
  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`
  return {
    background: hex(palette.backgroundTop),
    /* 글자는 그 바탕 위에서 읽혀야 한다 — 밝은 CAD 바탕에서는 진한 무채색으로 뒤집는다 */
    foreground: mode === 'cad' ? hex(CAD_VIEW.edgeColor) : '#eef2f7',
  }
}

/** 이 모드에서 점군을 그리는가 */
export function showsPoints(mode: ViewerDisplayMode): boolean {
  return mode !== 'cad'
}

/** 이 모드에서 CAD 솔리드를 그리는가 */
export function showsCad(mode: ViewerDisplayMode): boolean {
  return mode !== 'pcd'
}
