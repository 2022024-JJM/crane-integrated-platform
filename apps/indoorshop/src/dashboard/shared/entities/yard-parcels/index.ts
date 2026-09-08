/**
 * 야드 지번/공장 — 단일 소스 진입점.
 *
 * 대시보드·도장 화면은 **이 파일만** import 한다. 지번 fixture(550건 폴리곤)는 무거우므로
 * `loadYardParcels()` 가 처음 불릴 때 dynamic import 로 끌어와, 이 데이터를 안 쓰는 화면
 * (예: 야드 대시보드 첫 화면)의 번들에는 실리지 않는다. 디코딩 결과는 한 번만 만들고
 * 캐시해 공유한다 — 목록과 맵이 같은 배열을 봐야 참조 비교로 부분집합을 가릴 수 있다.
 *
 * 실연동(지번 마스터를 API 로 받는) 시 이 로더 몸통만 교체하면 되고, 화면은 손대지 않는다.
 */
import {
  colorOfParcelCategory,
  type LatLon,
  type LatLonBounds,
  type YardParcelBay,
  type YardParcelFactory,
  type YardParcelLot,
  type YardParcels,
} from './types'

export {
  PARCEL_CATEGORY_COLORS,
  colorOfParcelCategory,
  PROCESS_COLORS,
  NO_PROCESS_COLOR,
  colorOfProcess,
  type LatLon,
  type LatLonBounds,
  type YardParcelBay,
  type YardParcelFactory,
  type YardParcelLot,
  type YardParcels,
} from './types'

/** RAW 평탄 폴리곤(lat,lon 교대) → {lat,lon}[] */
function decodePolygon(flat: readonly number[]): LatLon[] {
  const poly: LatLon[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) poly.push({ lat: flat[i], lon: flat[i + 1] })
  return poly
}

let cache: Promise<YardParcels> | null = null

/** 야드 지번/공장 데이터 — 한 번만 로드·디코딩하고 이후엔 캐시를 돌려준다 */
export function loadYardParcels(): Promise<YardParcels> {
  if (cache) return cache
  const sources = Promise.all([import('./parcelsFixture'), import('./parcelBaysFixture')])
  cache = sources.then(([{ RAW_PARCEL_LOTS, RAW_PARCEL_FACTORIES }, { RAW_PARCEL_BAYS }]) => {
    const lots: YardParcelLot[] = RAW_PARCEL_LOTS.map(
      ([lot, factory, process, category, label, area, place, flat]) => ({
        lot,
        factory,
        process,
        category,
        label,
        area,
        place,
        polygon: decodePolygon(flat),
      })
    )
    const factories: YardParcelFactory[] = RAW_PARCEL_FACTORIES.map(
      ([name, process, anchorLat, anchorLon, lotCodes]) => ({
        name,
        process,
        lotCodes: [...lotCodes],
        /* 소속 지번이 있으면 anchor 는 항상 채워진다(스크립트 보장). 방어적으로 0,0 대비 */
        labelAnchor: { lat: anchorLat ?? 0, lon: anchorLon ?? 0 },
      })
    )
    /* 베이 — 지도 fixture 에 실재하는 지번만 남긴다(생성기가 이미 걸렀지만 방어적으로).
     * 베이명은 공장 안에서만 유일하므로 id 는 `{공장}#{베이}` 복합키다. */
    const known = new Set(lots.map((lot) => lot.lot))
    const bays: YardParcelBay[] = RAW_PARCEL_BAYS.flatMap(
      ([bayKey, factory, bay, process, lotCodes, hullFlat]) => {
        const codes = lotCodes.filter((code) => known.has(code))
        if (codes.length === 0) return []
        return [
          {
            bayKey,
            factory,
            bay,
            id: `${factory}#${bay}`,
            label: `${bay}BAY`,
            process,
            lotCodes: codes,
            hull: decodePolygon(hullFlat),
          },
        ]
      }
    )

    return { lots, factories, bays, categoryColor: colorOfParcelCategory }
  })
  return cache
}

/**
 * 지번 묶음을 감싸는 경계 상자 — 카메라를 그 자리로 보낼 때(focusBounds) 쓴다.
 * 지도 fixture 에 없는 지번은 조용히 빠지고, 하나도 없으면 null 이다.
 */
export function boundsOfLots(
  parcels: YardParcels,
  lotCodes: Iterable<string>
): LatLonBounds | null {
  const codes = lotCodes instanceof Set ? lotCodes : new Set(lotCodes)
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const lot of parcels.lots) {
    if (!codes.has(lot.lot)) continue
    for (const p of lot.polygon) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lon < minLon) minLon = p.lon
      if (p.lon > maxLon) maxLon = p.lon
    }
  }
  if (minLat === Infinity) return null
  return { minLat, minLon, maxLat, maxLon }
}

/**
 * 특정 공장이 차지하는 경계 상자 — 지도를 그 공장으로 날아가게(focusBounds) 할 때 쓴다.
 * 소속 지번 폴리곤 전체를 감싼다. 없는 공장이면 null.
 */
export function factoryBounds(
  parcels: YardParcels,
  factoryName: string
): LatLonBounds | null {
  const factory = parcels.factories.find((f) => f.name === factoryName)
  if (!factory) return null
  return boundsOfLots(parcels, factory.lotCodes)
}
