/**
 * 애플리케이션 메타 정보 — 단일 출처.
 * 계정 메뉴·설정 화면·푸터가 같은 값을 보게 해서 버전이 어긋나지 않게 한다.
 *
 * 사람이 읽는 이름(제품명·조직명)은 여기 두지 않는다 — 언어마다 달라지므로
 * 번역 리소스(`app.*`)의 몫이다. 여기 남는 것은 **언어와 무관한 값**뿐이다.
 */
export const APP_INFO = {
  version: '0.1.0',
  /** 저작권 표기 시작 연도 — 해가 바뀌어도 손대지 않도록 끝 연도는 계산한다 */
  since: 2025,
} as const

/** 화면에 그대로 쓰는 버전 표기 */
export const APP_VERSION_LABEL = `v${APP_INFO.version}`

/**
 * 저작권 연도 구간.
 * 첫 해와 올해가 같으면 한 해만 쓴다 — "2025–2025" 는 사람이 쓰지 않는 표기다.
 */
export function copyrightYears(): string {
  const current = new Date().getFullYear()
  return current > APP_INFO.since ? `${APP_INFO.since}–${current}` : String(APP_INFO.since)
}
