import type { InshopKey } from '../i18n/keys'

/**
 * 글자 크기 설정.
 *
 * 브라우저 확대(Ctrl +)는 3D 뷰포트의 픽셀 밀도까지 함께 키워 점군이 뭉개진다 —
 * 그래서 확대 대신 **타이포 스케일 배율**만 따로 둔다. 값은 CSS 변수
 * `--app-font-scale` 로 나가고, 텍스트 토큰 전체가 그 배율을 곱해 쓴다.
 */
export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

export const FONT_SCALE_VALUES: Record<FontScale, number> = {
  sm: 0.92,
  md: 1,
  lg: 1.15,
  xl: 1.3,
}

export const FONT_SCALE_OPTIONS: {
  value: FontScale
  labelKey: InshopKey
  descriptionKey: InshopKey
}[] = [
  { value: 'sm', labelKey: 'fontScale.sm', descriptionKey: 'fontScale.smDescription' },
  { value: 'md', labelKey: 'fontScale.md', descriptionKey: 'fontScale.mdDescription' },
  { value: 'lg', labelKey: 'fontScale.lg', descriptionKey: 'fontScale.lgDescription' },
  { value: 'xl', labelKey: 'fontScale.xl', descriptionKey: 'fontScale.xlDescription' },
]

const STORAGE_KEY = 'font-scale'

function isFontScale(value: string | null): value is FontScale {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'xl'
}

export function getInitialFontScale(): FontScale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isFontScale(stored)) return stored
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 기본값으로 넘어간다
  }
  return 'md'
}

export function applyFontScale(scale: FontScale): void {
  document.documentElement.style.setProperty(
    '--app-font-scale',
    String(FONT_SCALE_VALUES[scale])
  )

  try {
    localStorage.setItem(STORAGE_KEY, scale)
  } catch {
    // 저장에 실패해도 이번 세션 동작에는 영향이 없다
  }
}
