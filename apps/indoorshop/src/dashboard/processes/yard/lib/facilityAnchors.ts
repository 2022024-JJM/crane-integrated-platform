import { fetchYardFacilities, FACILITY_PROCESSES } from './facilities'
import { mergeBounds } from '../../../shared/features/yard-map/model/types'
import type { ProcessFacilityAnchor } from '../../../shared/model/processFacilityAnchor'

/**
 * 공정존 → 대표 시설·좌표 매핑을 야드 기준정보로부터 산출한다.
 *
 * 야드는 41개 시설이 어느 공정 소속인지(`FACILITY_PROCESSES`)와 각 시설의 좌표
 * (`fetchYardFacilities` — 본체 무게중심·외곽 경계)를 안다. 대시보드가 지도 위에
 * 공정존 상태를 얹을 자리를 이 둘로 계산해 `shared/model` 계약으로 내보낸다.
 *
 * 대상은 **화면 경로(zonePath)가 있는 4개 공정존**(조립·도장·의장·가공)뿐이다 —
 * 전처리·미지정 갈래는 대시보드 공정존 카드가 없어 오버레이 대상이 아니다.
 *
 * 가정(합리적 기본값):
 *  - 대표 좌표 = 그 공정에 속한 시설 중 **본체 구획 수(sections)가 가장 큰 시설**의
 *    무게중심. 규모가 가장 큰 공장이 그 공정의 얼굴이라 보고, 실재하는 한 지점을
 *    골라 배지가 빈 자리(시설들의 산술평균이 놓일 수 있는)에 뜨지 않게 한다.
 *    구획 수가 동수면 목록 순서가 앞선 시설을 쓴다.
 *  - `bounds` = 그 공정 전체 시설을 감싼 경계 상자 (지도가 공정으로 줌인할 때 쓴다).
 */
export function buildProcessFacilityAnchors(): ProcessFacilityAnchor[] {
  const facilities = fetchYardFacilities()

  return FACILITY_PROCESSES.filter((process) => process.zonePath !== null).flatMap(
    (process) => {
      const members = facilities.filter((facility) => facility.process.key === process.key)
      if (members.length === 0) return []

      const representative = members.reduce((best, facility) =>
        facility.sections > best.sections ? facility : best
      )
      const bounds = members.map((facility) => facility.bounds).reduce(mergeBounds)

      return [
        {
          // zonePath 는 위 filter 로 non-null 이 보장된다
          zonePath: process.zonePath as string,
          processKey: process.key,
          label: process.label,
          anchor: representative.anchor,
          representativeName: representative.name,
          bounds,
          facilities: members.map((facility) => ({
            name: facility.name,
            anchor: facility.anchor,
            bounds: facility.bounds,
            sections: facility.sections,
            lotCount: facility.lotCount,
          })),
        },
      ]
    }
  )
}
