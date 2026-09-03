import type { AssyPlacement, BlockSite, ProcessZone, RosterBlock } from '../model/types'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'

/**
 * 블록이 지금 서 있는 **자리들** — 지도 마커의 근거.
 *
 * 이 파일이 답하는 질문은 "이 블록 어디 있어요"다. 답이 점 하나가 아닌 것이 요지다:
 *
 *  - **가공 중** — 자리가 **없다**. 가공권역은 필드 수집이 없어 부재의 물리 위치를 알
 *    원천이 아예 없다. 공장 앵커로라도 찍으면 "여기 있다"는 거짓말이 되므로 빈 배열을
 *    낸다 — 화면은 마커 대신 상태로 말해야 한다.
 *  - **조립 중** — ASSY 가 여러 공장에 흩어져 있다. 소조 공장에서 소조를 붙여 중조
 *    공장으로 보내고 대조 정반에서 합치므로, 한 블록이 동시에 여러 자리를 차지한다.
 *  - **의장·도장 중** — 그 공장(구역/BTS 귀속) 한 자리.
 *  - **전이 중** — 대조가 먼저 도장으로 넘어간 것처럼 자리마다 공정이 다를 수 있다.
 *    그래서 공정은 블록이 아니라 **자리**가 들고 있다.
 *
 * 같은 (공정, 공장, 베이)의 ASSY 는 **한 마커로 묶는다** — 열 개짜리 블록이 열 개의 핀으로
 * 지도를 덮으면 흩어짐이 보이는 게 아니라 안 보인다.
 */

/** 자리 하나의 공정 화면 경로 — 정반이 정해졌으면 정반 상세까지, 아니면 그 공장을 연 맵 */
function pathOf(zone: ProcessZone, factory: string, berth?: AssyPlacement['berth']): string {
  if (berth) return `/zones/assembly/${berth.factoryId}/${berth.bayId}`
  /* 드릴다운 계약으로 적는다 — 값은 안정 슬러그(F-30), 옛 `?shop=`·이름 값은 읽기 전용 */
  return drilldownHref(`/zones/${zone}`, '', { ...YARD_DRILLDOWN, factory })
}

function siteId(zone: ProcessZone, factory: string, mapBay?: string): string {
  return `${zone}@${factory}#${mapBay ?? '-'}`
}

/**
 * 블록의 자리 목록. 순서는 **ASSY 가 많은 자리 먼저**, 같으면 자리 id 순 —
 * 마커가 겹칠 때 무엇을 위에 둘지, 카드가 무엇을 먼저 적을지가 렌더링마다 흔들리지 않게.
 */
export function sitesOfBlock(block: RosterBlock): BlockSite[] {
  /* 가공 중 — 추적할 원천이 없다 (위 주석) */
  if (block.zone === 'fabrication') return []

  if (block.assyUnits && block.assyUnits.length > 0) {
    const byId = new Map<string, BlockSite>()
    for (const unit of block.assyUnits) {
      const id = siteId(unit.zone, unit.factory, unit.mapBay)
      const site = byId.get(id)
      if (site) {
        ;(site.assys as { assyNo: string; tier: AssyPlacement['tier'] }[]).push({
          assyNo: unit.assyNo,
          tier: unit.tier,
        })
        continue
      }
      byId.set(id, {
        id,
        zone: unit.zone,
        factory: unit.factory,
        mapBay: unit.mapBay,
        assys: [{ assyNo: unit.assyNo, tier: unit.tier }],
        path: pathOf(unit.zone, unit.factory, unit.berth),
      })
    }
    return [...byId.values()].sort(
      (a, b) => b.assys.length - a.assys.length || a.id.localeCompare(b.id)
    )
  }

  /* ASSY 소재가 적히지 않은 블록 — 블록 단위 한 자리 */
  const berth = block.berth ? { factoryId: block.berth.factoryId, bayId: block.berth.bayId } : undefined
  return [
    {
      id: siteId(block.zone, block.factory, block.mapBay),
      zone: block.zone,
      factory: block.factory,
      mapBay: block.mapBay,
      assys: [],
      path: pathOf(block.zone, block.factory, berth),
    },
  ]
}

/** 지도에 찍을 자리가 있는 블록인가 — 가공 중이면 false */
export function isBlockTrackable(block: RosterBlock): boolean {
  return sitesOfBlock(block).length > 0
}

/**
 * 자리들이 가리키는 공정 — 하나면 그 공정, 여럿이면 null.
 * 블록 단계와 다른 자리가 섞여 있는지(전이 중) 화면이 판단하는 근거다.
 */
export function zonesOfSites(sites: readonly BlockSite[]): ProcessZone[] {
  return [...new Set(sites.map((site) => site.zone))]
}

/**
 * **단계 전이 중인 블록인가** — 직전 공정을 끝내고 이 공정에 막 넘어온 상태.
 *
 * 예전에는 "자리 공정이 블록 단계와 다른가"로 판정했다(대조만 먼저 도장으로 넘어간
 * 상태). 그 모양은 공정 순서와 어긋난다 — 소조·중조는 대조 **안에** 들어가므로, 대조가
 * 도장에 가 있는데 하위가 조립 공장에 남아 있을 수 없다. 흩어짐은 아직 안 합쳐진
 * 조립 단계의 사실이고, 전이는 **블록 단계의 경계**에서 일어난다.
 *
 * 그래서 판정 근거를 로스터의 `justArrived` 로 옮겼다 — 이 공정에 막 도착해 실적이
 * 아직 서지 않은 블록이다.
 */
export function isBlockInTransition(block: RosterBlock): boolean {
  return block.justArrived === true
}
