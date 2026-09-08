import { describe, expect, it } from 'vitest'
import { assemblyModule } from '../processes/assembly/module'
import { outfittingModule } from '../processes/outfitting/module'
import { paintingModule } from '../processes/painting/module'
import { zoneJumpHref } from '../shared/features/dashboard-map/lib/zoneJump'
import { parseDrilldown } from '../shared/lib/drilldownUrl'

/*
 * 공정존 대문 계약 (R22) — 맵 진입 화면을 걷은 뒤의 약속.
 *
 *  · `/indoorshop/zones/{공정}` 은 **워크스페이스**로 간다 (맵 진입 화면이 되살아나지 않는다)
 *  · 총괄('/')의 점프는 그 대문으로 `?factory=` 를 실어 보낸다
 *
 * 여기가 깨지면 "맵이 너무 많다"가 조용히 되돌아온다.
 */
const ZONES = [
  { id: 'assembly', module: assemblyModule, process: '조립' },
  { id: 'outfitting', module: outfittingModule, process: '의장' },
  { id: 'painting', module: paintingModule, process: '도장' },
] as const

describe('공정존 라우트 — 대문은 워크스페이스', () => {
  it('세 공정 모두 `/indoorshop/zones/{공정}` 라우트를 갖는다', () => {
    for (const { id, module } of ZONES) {
      expect(module.routes.some((r) => r.path === `/indoorshop/zones/${id}`)).toBe(true)
    }
  })

  it('대문과 공장 화면이 **같은 화면**이다 — 맵 진입이 따로 서지 않는다', () => {
    for (const { id, module } of ZONES) {
      const entry = module.routes.find((r) => r.path === `/indoorshop/zones/${id}`)!
      /* 조립·의장은 `:factoryId`, 도장은 `/:factoryId` 가 그 공정의 공장 화면이다 */
      const factoryRoute = module.routes.find((r) => r.path === `/indoorshop/zones/${id}/:factoryId`)!
      expect(factoryRoute).toBeDefined()
      expect(entry.Component).toBe(factoryRoute.Component)
    }
  })

  it('맵 진입 전용 라우트가 남아 있지 않다', () => {
    for (const { module } of ZONES) {
      for (const route of module.routes) {
        expect(String(route.path)).not.toContain('/map')
      }
    }
  })
})

describe('총괄 점프 — 착지가 그 공정의 대문이다', () => {
  it('점프 주소가 `/indoorshop/zones/{공정}?factory=` 다 — 대문이 곧 워크스페이스', () => {
    for (const { id, process } of ZONES) {
      const href = zoneJumpHref(process, 'GBS')
      expect(href, `${process}: 점프 문이 없다`).not.toBeNull()
      const [path, query] = href!.split('?')
      expect(path).toBe(`/indoorshop/zones/${id}`)
      /* 실어 보낸 값은 그 공장 — 착지 화면이 좌측 레일에서 그것을 편다 */
      expect(parseDrilldown(query).factory).toBe('GBS')
    }
  })
})
