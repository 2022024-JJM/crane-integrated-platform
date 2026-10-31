/*
 * **임베드 모드** — 앱 화면 하나를 다른 화면의 창(iframe) 안에 띄울 때의 셸.
 *
 * 야드 맵이 3D 뷰어·통합실적·현황 화면을 **화면을 떠나지 않고** 보여 주려면 그 화면들을
 * 창 안에 그려야 한다. 그런데 그 화면들은 공정 모듈(`processes/*`)의 것이라 shared 인
 * 야드 맵이 import 할 수 없다(모듈 경계). 그래서 컴포넌트가 아니라 **주소**로 띄운다 —
 * 같은 앱을 iframe 에 열고, 셸(사이드바·헤더·푸터·투어)은 걷어 본문만 남긴다.
 *
 * 판정은 **문서가 처음 열릴 때의 주소**로 한 번만 한다(`?embed=1`). 창 안에서 화면을
 * 옮겨 다니면 쿼리가 빠지지만, 그 문서는 여전히 창 안이므로 셸 없이 그대로 간다.
 */

/** 임베드 쿼리 키 */
export const EMBED_PARAM = 'embed'

/** 이 문서가 임베드로 열렸는가 — 문서 수명 동안 고정 */
export const IS_EMBEDDED: boolean =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(EMBED_PARAM) === '1'

/** 이 경로를 임베드로 연다 — 이미 쿼리가 붙어 있으면 이어 붙인다 */
export function withEmbed(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${EMBED_PARAM}=1`
}

/** 임베드 쿼리를 뗀 주소 — 창에서 보던 화면을 **창 밖(전체 화면)** 으로 열 때 */
export function withoutEmbed(path: string): string {
  const [base, query = ''] = path.split('?', 2)
  const params = new URLSearchParams(query)
  params.delete(EMBED_PARAM)
  const rest = params.toString()
  return rest ? `${base}?${rest}` : base
}
