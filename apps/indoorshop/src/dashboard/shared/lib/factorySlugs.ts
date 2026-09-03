/*
 * 공장 이름 ↔ URL 슬러그 (UX 감사 F-30).
 *
 * 드릴다운 URL 이 `?factory=조립4공장-OFD1` 처럼 **한글 이름을 그대로** 실었다 —
 * 주소창에서는 percent-인코딩 덩어리로 보이고, 공장 개명 한 번이면 뿌려 둔 링크가
 * 전부 죽는다(도장 factoryRoutes 주석이 경고하던 그 사고). 값을 안정 슬러그로 바꾼다.
 *
 * 슬러그는 **각 공정 모듈이 이미 라우트 경로에 쓰는 id 를 그대로** 쓴다 —
 * `/zones/assembly/asm-gbs`(조립) · `ofit-pos1`(의장) · `pnt-1dock`(도장). 경로 조각과
 * 쿼리 값이 같은 어휘라야 주소를 읽는 사람이 한 체계만 배우면 된다. 그 id 가 없는
 * 가공·야드 공장은 여기서 같은 문법(fab-*)으로 채번한다.
 *
 * **이 표는 손으로 관리하는 스냅샷이다** — 이름에서 파생하지 않는다(파생하면 개명이
 * 곧 슬러그 변경이라 안정성이 사라진다). 새 공장이 지도에 서면 여기 한 줄을 더한다.
 * 표에 없는 이름은 이름 그대로 URL 에 실린다(동작은 하되, 이 파일이 추가를 요구한다).
 *
 * 낡은 링크(한글 이름 값)는 계속 읽힌다 — `drilldownUrl.parseDrilldown` 이 슬러그
 * 조회에 실패하면 값을 이름으로 그대로 쓴다(읽기 호환).
 */

/** 슬러그 → 공장 이름 (지번 fixture `RAW_PARCEL_FACTORIES` 의 이름 26곳 전부) */
export const FACTORY_BY_SLUG: Readonly<Record<string, string>> = {
  /* 조립 — processes/assembly/api/assemblyFactoryFixture.ts 의 id 와 동일 */
  'asm-gbs': 'GBS',
  'asm-nps': 'NPS',
  'asm-pbs': 'PBS',
  'asm-3ds': '3DS',
  'asm-of1': '조립4공장-OFD1',
  'asm-of2': '조립4공장-OFD2',
  'asm-of3': '조립4공장-OFD3',
  /* 의장 — processes/outfitting/api/outfittingFactoryFixture.ts 의 id 와 동일 */
  'ofit-pos1': 'POS 1공장',
  'ofit-dm2': '두모 선행의장 2공장',
  'ofit-bos1': '조립의장 1공장 BOS 1',
  'ofit-bos2': '조립의장 2공장 BOS 2',
  'ofit-bos3': '조립의장 3공장 쉘터',
  'ofit-gos': 'GOS 조립의장 쉘터',
  'ofit-ofd': 'OFD조립의장 셸터',
  /* 도장 — processes/painting/lib/factoryRoutes.ts 의 id 와 동일 */
  'pnt-1dock': '1DOCK 도장공장',
  'pnt-2dock': '2DOCK 도장공장',
  'pnt-neutae': '느태 도장공장',
  'pnt-texaco': '텍사코 도장공장',
  'pnt-gps': 'GPS',
  /* 가공 — 공정 모듈에 id 표가 없어 여기서 같은 문법으로 채번 */
  'fab-pas': 'PAS',
  'fab-cas': 'CAS',
  'fab-cts': 'CTS',
  'fab-ssy': 'SSY',
  'fab-ocean-cut': '해양절단공장',
  'fab-section-cut': '형강 절단공장',
  'fab-tbar': 'T-BAR 절단공장',
}

const SLUG_BY_FACTORY: ReadonlyMap<string, string> = new Map(
  Object.entries(FACTORY_BY_SLUG).map(([slug, name]) => [name, slug]),
)

/** 공장 이름 → 슬러그. 표에 없으면 null — 호출부(writeDrilldown)는 이름을 그대로 쓴다 */
export function factorySlugOf(name: string): string | null {
  return SLUG_BY_FACTORY.get(name) ?? null
}

/** 슬러그 → 공장 이름. 슬러그가 아니면 null — 호출부(parseDrilldown)는 이름으로 폴백한다 */
export function factoryNameOfSlug(value: string): string | null {
  return FACTORY_BY_SLUG[value] ?? null
}
