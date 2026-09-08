import { useEffect, useMemo, useState } from 'react'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { fetchYardMapBackdrop } from '../../../model/processRegistry'
import type { YardBackdropBlock } from '../../../model/yardMapBackdrop'
import { useBaseDate } from '../../../lib/useBaseDate'
import { buildEquipmentSearchCtx, type EquipmentSearchCtx, type SearchSources } from './searchIndex'
import { woEntriesOf } from './woIndex'

/*
 * 검색 원천 한 벌을 모으는 훅 — **두 진입점이 이 훅 하나를 쓴다.**
 *
 * 팔레트(Cmd+K)와 대시보드 지도 위 검색창이 각자 원천을 모으면, 같은 글자에 다른 답이
 * 나오는 상태로 조용히 갈라진다(실제로 그랬다 — 야드 BTS 색인은 지도 검색만 갖고 있었다).
 * 어느 화면에서 열든 같은 것을 보게 하려면 원천도 한 곳에서 와야 한다.
 *
 * 비동기 셋은 각자 자기 속도로 도착하고, 도착하지 않은 원천은 그 그룹만 비운다 —
 * 로스터·설비 목록은 정적이라 첫 글자부터 결과가 뜬다(검색이 로딩을 기다리지 않는다).
 *
 * 세 원천 모두 **모듈 수준 캐시**를 가진 로더라, 두 진입점이 함께 떠 있어도 실제 로드는
 * 한 번뿐이다 (`loadYardParcels`·`woEntriesOf` 캐시, 배경은 아래 모듈 캐시).
 */

/** 야드 BTS 색인 — 배경(야드 모듈)에서 한 번만 받아 모듈에 쥔다 */
let yardIndexCache: Promise<readonly YardBackdropBlock[]> | null = null

function loadYardIndex(): Promise<readonly YardBackdropBlock[]> {
  yardIndexCache ??= fetchYardMapBackdrop()
    .then((backdrop) => backdrop?.blockIndex?.() ?? [])
    .catch(() => {
      /* 다음 시도에서 다시 부를 수 있게 캐시를 비운다 — 배경이 늦게 뜰 수도 있다 */
      yardIndexCache = null
      return []
    })
  return yardIndexCache
}

/** 테스트 격리 — 모듈 캐시를 비운다 */
export function resetYardIndexCache(): void {
  yardIndexCache = null
}

/**
 * 야드 BTS 색인만 — 총괄 지도가 주소의 블록을 해석할 때 쓴다(`parseMapFocus`).
 *
 * 검색 원천 전체(`useSearchSources`)를 부르지 않는 이유는 W/O 색인 때문이다: 그것은
 * 로스터 전 블록의 실적을 한 번 생성하는 일이라, 검색을 열지도 않은 대시보드 첫 화면이
 * 치를 값이 아니다. 색인 자체는 같은 모듈 캐시라 검색이 열릴 때 다시 받지 않는다.
 */
export function useYardBlockIndex(): readonly YardBackdropBlock[] | null {
  const [index, setIndex] = useState<readonly YardBackdropBlock[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadYardIndex().then((next) => {
      if (alive) setIndex(next)
    })
    return () => {
      alive = false
    }
  }, [])
  return index
}

export function useSearchSources(): SearchSources {
  /* 기준일 — `?date=` 를 따라온다. 되감은 화면에서 검색하면 그날의 W/O 를 찾는다 */
  const { baseDate } = useBaseDate()
  const [equipment, setEquipment] = useState<EquipmentSearchCtx | null>(null)
  const [yard, setYard] = useState<readonly YardBackdropBlock[] | null>(null)

  useEffect(() => {
    let alive = true
    void loadYardParcels()
      .then((parcels) => {
        if (alive) setEquipment(buildEquipmentSearchCtx(parcels))
      })
      .catch(() => {
        /* 지번이 없으면 설비 그룹만 비고 나머지 검색은 그대로 선다 */
      })
    void loadYardIndex().then((index) => {
      if (alive) setYard(index)
    })
    return () => {
      alive = false
    }
  }, [])

  const wos = useMemo(() => woEntriesOf(baseDate), [baseDate])

  return useMemo(() => ({ wos, equipment, yard }), [wos, equipment, yard])
}
