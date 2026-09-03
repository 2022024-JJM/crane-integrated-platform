import { PAINTING_FACTORIES } from '../../../shared/entities/vessel'

/*
 * 도장 공장 ↔ 라우트 id.
 *
 * 조립·의장은 공장 fixture 가 id 를 이미 갖고 있어(`asm-pbs`·`ofit-pos1`) 공장 카드에서
 * 공장 화면으로 그 id 로 건너간다. 도장은 공장 목록이 **설비 배치에서 유도**된 이름
 * 문자열뿐이라 id 가 없었다 — 그래서 공장 화면으로 갈 문이 없었다.
 *
 * 여기서 그 한 겹만 만든다. 규칙은 두 가지다:
 *  · **이름을 URL 에 싣지 않는다.** 한글 공장명을 경로에 넣으면 인코딩된 경로가 되고
 *    공장 이름을 고치는 순간 링크가 깨진다. `?shop=<공장명>` 딥링크(야드·통합실적·
 *    알람이 이미 쓰는 계약)는 그대로 두되, 공장 **화면**의 주소는 안정적인 id 로 연다.
 *  · **id 는 손으로 적는다.** 이름에서 슬러그를 계산하면(한글 → 로마자) 이름이 바뀔 때
 *    주소도 조용히 바뀐다. 짧은 표라 적어 두는 편이 정직하다.
 *
 * 이름의 정본은 로스터의 `PAINTING_FACTORIES` 다(BTS 귀속 후보이자 `?shop=` 딥링크 계약).
 * 아래 표가 그 목록과 어긋나면 `__tests__/factoryRoutes.test.ts` 가 잡는다.
 */

/** 라우트 id → 공장 이름 — 공장 카드·공장 현황 화면이 쓰는 한 겹 */
export const PAINTING_FACTORY_ROUTE_IDS: Readonly<Record<string, string>> = {
  'pnt-1dock': '1DOCK 도장공장',
  'pnt-2dock': '2DOCK 도장공장',
  'pnt-neutae': '느태 도장공장',
  'pnt-texaco': '텍사코 도장공장',
  'pnt-gps': 'GPS',
}

const idOfFactory = new Map(
  Object.entries(PAINTING_FACTORY_ROUTE_IDS).map(([id, factory]) => [factory, id])
)

/** 공장 이름 → 라우트 id (모르는 공장은 null — 없는 문을 만들지 않는다) */
export function paintingFactoryIdOf(factory: string): string | null {
  return idOfFactory.get(factory) ?? null
}

/** 라우트 id → 공장 이름 (모르는 id 는 null) */
export function paintingFactoryNameOf(id: string): string | null {
  return PAINTING_FACTORY_ROUTE_IDS[id] ?? null
}

/* 공장 현황 경로(`paintingFactoryStatusHref`)는 `lib/collection` 에 둔다 — 조립·의장이
 * `factoryStatusHref` 를 수집 현황 구성과 한 파일에 둔 것과 같은 자리다. */

/** 맵 진입으로 돌아가되 그 공장을 연 채로 — 공장 현황 화면의 '뒤로' */
export function paintingMapPath(factory: string): string {
  /* 새 링크는 새 철자 — 옛 `?shop=` 은 읽기 전용으로 남는다(drilldownUrl 계약) */
  return `/zones/painting?factory=${encodeURIComponent(factory)}`
}

/** 로스터가 아는 도장 공장 전체 — 라우트 표의 정합성 검사 기준 */
export const ROSTER_PAINTING_FACTORIES = PAINTING_FACTORIES
