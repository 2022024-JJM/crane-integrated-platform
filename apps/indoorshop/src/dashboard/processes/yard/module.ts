import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { YardIcon } from '../../shared/ui/icons'
import { yardKo } from './i18n/ko'
import { yardEn } from './i18n/en'

/*
 * 야드 모듈 선언.
 *
 * 야드는 공정존이 아니다 — 조립·가공처럼 실적을 만드는 곳이 아니라 그 사이를 잇는
 * 일이라 `logistics` 묶음에 서고, 대시보드 공정존 카드(zone)를 두지 않는다.
 */

const YardWorkspace = lazy(() =>
  import('./ui/pages/YardWorkspace').then((m) => ({ default: m.YardWorkspace }))
)

export const yardModule: ProcessModule = {
  id: 'yard',
  order: 50,
  navGroup: 'logistics',
  nav: {
    path: '/indoorshop/logistics/yard',
    id: 'yard',
    labelKey: 'yard.nav.label',
    icon: YardIcon,
  },
  routes: [{ path: '/indoorshop/logistics/yard', Component: YardWorkspace }],
  i18n: { ko: yardKo, en: yardEn },
  provides: {
    // 대시보드가 지도 위에 공정존 상태를 얹을 자리 — 야드 시설 데이터로 산출한다.
    // 무거운 계산이 대시보드만 보는 사용자에게 실리지 않게 lazy 로 둔다.
    facilityAnchors: () =>
      import('./lib/facilityAnchors').then((m) => m.buildProcessFacilityAnchors()),
    /*
     * 야드 지도 배경 — 베이스맵(~980KB)·범위·색·시설. 대시보드·도장 등 다른 화면이
     * YardMap 을 배경으로 쓸 때 넘길 값들. 그 무게가 필요 없는 화면에 실리지 않도록 lazy.
     * ⚠️ 통합 임시: mapBackdrop(대시보드)·yardMapBackground(도장)이 동일 로더 — 하나로 통일 필요(아침 결정).
     */
    mapBackdrop: () =>
      Promise.all([
        import('./lib/basemapStyle'),
        import('./api/yardRepository'),
        import('./lib/facilities'),
      ]).then(([basemap, repo, facilities]) => ({
        basemapLayers: basemap.BASEMAP_LAYERS,
        extent: repo.yardExtent(),
        colorOfCategory: repo.colorOfCategory,
        facilities: facilities.fetchYardFacilities(),
        /* 블록 검색 색인 — 대시보드가 첫 검색 때 부른다. 데이터는 야드 화면과 같은
         * 원천(BTS 블록 위치)이라 두 화면이 같은 자리를 말한다. 지번 이름은 위치 설명
         * 맥락으로만 얹는다(대시보드는 지번 단위 정보를 표면에 내지 않는다). */
        blockIndex: () =>
          import('./api/yardRepository').then((r) =>
            r.fetchYardBlocks().map((b) => ({
              id: b.id,
              projNo: b.projNo,
              blkNo: b.blkNo,
              lat: b.lat,
              lon: b.lon,
              lot: b.lot,
              lotLabel: b.lot ? (r.findLot(b.lot)?.description ?? null) : null,
              updatedAt: b.updatedAt,
            }))
          ),
      })),
    yardMapBackground: () =>
      Promise.all([
        import('./lib/basemapStyle'),
        import('./api/yardRepository'),
        import('./lib/facilities'),
      ]).then(([basemap, repo, facilities]) => ({
        basemapLayers: basemap.BASEMAP_LAYERS,
        extent: repo.yardExtent(),
        colorOfCategory: repo.colorOfCategory,
        facilities: facilities.fetchYardFacilities(),
      })),
  },
}
