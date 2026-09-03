import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT, buildFactoryStatusSnapshot } from '../../../../shared/entities/equipment'
import { blocksInZone } from '../../../../shared/entities/vessel'
import { PAINTING_STEPS } from '../../../../shared/features/performance/model/types'
import {
  PAINTING_FACTORY_ROUTE_IDS,
  ROSTER_PAINTING_FACTORIES,
  paintingFactoryIdOf,
  paintingFactoryNameOf,
  paintingMapPath,
} from '../factoryRoutes'
import { paintingFactories } from '../../api/paintingRepository'
import {
  paintingCollectionOf,
  paintingCollectionRows,
  paintingFactoryStatusHref,
  paintingStepRollup,
  todayString,
} from '../collection'
import {
  PAINTING_SCADA_TYPE_IDS,
  PAINTING_SECTION_ORDER,
  paintingEquipmentSections,
  paintingInventoryOf,
} from '../equipmentInventory'

/**
 * 도장 맵 진입 우측 패널의 **구성과 값** (W6-6).
 *
 * 조립·의장이 `src/__tests__/panelComposition.test.ts` 에서 서로를 대조하듯, 도장은 여기서
 * 자기 규칙을 잠근다 — 구획 순서·대수의 출처·수집 줄의 바깥 두 줄·나가는 문. 렌더 테스트가
 * 없는 레포라 화면 규칙을 함수로 꺼내 둔 이유가 이것이다.
 *
 * 기준일을 고정한다 — 스텝 실적 mock 이 날짜를 먹으므로 오늘로 돌리면 테스트가 시계에 묶인다.
 */
const BASE_DATE = '2026-09-03'
const NOW = 1_756_000_000_000

describe('도장 공장 ↔ 라우트 id', () => {
  it('라우트 표가 로스터의 도장 공장 목록과 정확히 같다', () => {
    expect([...Object.values(PAINTING_FACTORY_ROUTE_IDS)].sort()).toEqual(
      [...ROSTER_PAINTING_FACTORIES].sort()
    )
  })

  it('설비에서 유도한 공장 목록과도 같다 — 지도와 로스터가 같은 다섯을 말한다', () => {
    expect([...paintingFactories()].sort()).toEqual([...ROSTER_PAINTING_FACTORIES].sort())
  })

  it('id ↔ 이름이 왕복한다', () => {
    for (const [id, factory] of Object.entries(PAINTING_FACTORY_ROUTE_IDS)) {
      expect(paintingFactoryIdOf(factory)).toBe(id)
      expect(paintingFactoryNameOf(id)).toBe(factory)
    }
  })

  it('모르는 공장·id 는 null — 안 열리는 문을 만들지 않는다', () => {
    expect(paintingFactoryIdOf('없는공장')).toBeNull()
    expect(paintingFactoryNameOf('pnt-없음')).toBeNull()
    expect(paintingFactoryStatusHref('없는공장')).toBeNull()
  })

  it('도장 5공장 모두 자기 현황 화면으로 간다 (조립·의장과 같은 경로 문법)', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      expect(paintingFactoryStatusHref(factory)).toMatch(/^\/zones\/painting\/[a-z0-9-]+$/)
    }
  })

  it('맵으로 돌아가는 길은 드릴다운 URL 계약 — 값은 안정 슬러그(F-30)다', () => {
    expect(paintingMapPath('1DOCK 도장공장')).toBe('/zones/painting?factory=pnt-1dock')
  })

  it('한글 공장명을 경로에 싣지 않는다 — 이름이 바뀌어도 주소가 살아 있어야 한다', () => {
    for (const id of Object.keys(PAINTING_FACTORY_ROUTE_IDS)) {
      expect(id).toMatch(/^pnt-[a-z0-9]+$/)
    }
  })
})

describe('설비 상태 단의 구획 — 조립·의장과 같은 원칙', () => {
  it('가동 자산(DH·GH) 먼저, 수집·네트워크 나중 순서로 선다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      const order = paintingEquipmentSections(factory).map((s) => s.typeId)
      expect(order).toEqual(PAINTING_SECTION_ORDER.filter((id) => order.includes(id)))
    }
  })

  it('구획 대수가 설비 엔티티의 실제 대수와 같다 — 화면이 세지 않고 데이터가 센다', () => {
    const countOf = (factory: string, typeId: string) =>
      YARD_EQUIPMENT.filter((e) => e.factory === factory && e.typeId === typeId).length
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const section of paintingEquipmentSections(factory)) {
        expect(section.count).toBe(countOf(factory, section.typeId))
      }
    }
  })

  it('SCADA 자산만 베이별로 나뉜다 — 이관 설비는 공장 단위 한 목록이다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const section of paintingEquipmentSections(factory)) {
        expect(section.groups !== undefined).toBe(
          PAINTING_SCADA_TYPE_IDS.includes(section.typeId)
        )
      }
    }
  })

  it('베이 묶음의 ID 합이 그 구획 대수와 같다 — 베이를 나누다 흘리지 않는다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const section of paintingEquipmentSections(factory)) {
        if (!section.groups) continue
        const ids = section.groups.flatMap((g) => g.ids)
        expect(ids).toHaveLength(section.count)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('설비가 없는 공장은 구획을 만들지 않는다 — 빈 제목만 남는 자리를 두지 않는다', () => {
    expect(paintingEquipmentSections('없는공장')).toEqual([])
  })

  it('이관 설비는 아직 0대다 — 없는 설비를 지어내 세우지 않는다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      const inventory = paintingInventoryOf(factory, buildFactoryStatusSnapshot(factory, NOW))
      expect(inventory.transferredTotal).toBe(0)
      expect(inventory.transferredUnits).toEqual([])
      expect(inventory.transferredIssues).toBe(0)
      /* 그래도 SCADA 자산은 서 있어야 한다 — 도장 86대의 소속 공장이 다섯이다 */
      expect(inventory.scadaTotal).toBeGreaterThan(0)
    }
  })

  it('SCADA 대수 합이 도장 설비 전체(86대)와 같다', () => {
    const total = ROSTER_PAINTING_FACTORIES.reduce(
      (sum, factory) => sum + paintingInventoryOf(factory, buildFactoryStatusSnapshot(factory, NOW)).scadaTotal,
      0
    )
    expect(total).toBe(
      YARD_EQUIPMENT.filter((e) => PAINTING_SCADA_TYPE_IDS.includes(e.typeId)).length
    )
  })
})

describe('수집 현황 — 조립·의장과 같은 바깥 두 줄', () => {
  const collection = paintingCollectionOf('1DOCK 도장공장', BASE_DATE)

  it('첫 줄이 감지, 마지막 줄이 최근 수집이다', () => {
    const tails = paintingCollectionRows(collection).map((r) => r.labelKey.split('.').at(-1))
    expect(tails[0]).toBe('detected')
    expect(tails.at(-1)).toBe('lastScan')
  })

  it('가운데는 도장의 축 — W/O · 스텝 절점 · 일일공정률', () => {
    const tails = paintingCollectionRows(collection).map((r) => r.labelKey.split('.').at(-1))
    expect(tails).toEqual(['detected', 'wo', 'steps', 'dailyRate', 'lastScan'])
  })

  it('진행 중 스텝이 없으면 일일공정률은 0% 가 아니라 대시 — 멈춘 것처럼 속이지 않는다', () => {
    const empty = paintingCollectionOf('텍사코 도장공장', BASE_DATE)
    expect(empty.blockCount).toBe(0)
    expect(empty.dailyProgressPct).toBeNull()
    const rows = paintingCollectionRows(empty)
    expect(rows.find((r) => r.labelKey.endsWith('dailyRate'))!.value).toBe('—')
    expect(rows.find((r) => r.labelKey.endsWith('lastScan'))!.value).toBe('—')
  })
})

describe('수집 집계 — 통합실적을 다시 계산하지 않는다', () => {
  it('로스터의 도장 재공 블록이 공장별 집계에 빠짐없이 들어간다', () => {
    const rostered = blocksInZone('painting')
    const collected = ROSTER_PAINTING_FACTORIES.flatMap(
      (factory) => paintingCollectionOf(factory, BASE_DATE).blocks
    )
    expect(collected).toHaveLength(rostered.length)
    expect(new Set(collected.map((b) => b.key)).size).toBe(rostered.length)
  })

  it('블록의 스텝 합이 공장 집계의 분모·분자와 같다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      const c = paintingCollectionOf(factory, BASE_DATE)
      expect(c.stepsTotal).toBe(c.blocks.reduce((n, b) => n + b.summary.steps.length, 0))
      expect(c.stepsDone).toBe(c.blocks.reduce((n, b) => n + b.summary.doneSteps, 0))
      expect(c.stepsDone).toBeLessThanOrEqual(c.stepsTotal)
      expect(c.stepsConfirmed).toBeLessThanOrEqual(c.stepsDone)
    }
  })

  it('진행 중 스텝은 블록마다 많아야 하나다 — 스텝은 순차 절점이다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const block of paintingCollectionOf(factory, BASE_DATE).blocks) {
        const running = block.summary.steps.filter((s) => s.status === 'inProgress')
        expect(running.length).toBeLessThanOrEqual(1)
        expect(block.activeStep).toEqual(running[0] ?? null)
      }
    }
  })

  it('공장 귀속 블록은 모두 도장 재공이다 — 조립·의장 블록이 섞이지 않는다', () => {
    const paintingKeys = new Set(blocksInZone('painting').map((b) => `${b.projNo}-${b.blockNo}`))
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const block of paintingCollectionOf(factory, BASE_DATE).blocks) {
        expect(paintingKeys.has(block.key)).toBe(true)
      }
    }
  })

  it('같은 기준일이면 같은 값을 낸다 — 화면이 렌더마다 흔들리지 않는다', () => {
    const a = paintingCollectionOf('1DOCK 도장공장', BASE_DATE)
    const b = paintingCollectionOf('1DOCK 도장공장', BASE_DATE)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('스텝 롤업 — 분모는 그 스텝을 계획한 블록 수다 (존재 기반)', () => {
  it('스텝 축은 S/P → T/UP → FINAL 순서 그대로다', () => {
    const rollup = paintingStepRollup(paintingCollectionOf('1DOCK 도장공장', BASE_DATE))
    expect(rollup.map((r) => r.step)).toEqual([...PAINTING_STEPS])
  })

  it('계획하지 않은 스텝은 분모가 0 — 미착수로 세지 않는다', () => {
    const empty = paintingStepRollup(paintingCollectionOf('텍사코 도장공장', BASE_DATE))
    for (const row of empty) {
      expect(row.blocks).toBe(0)
      expect(row.done).toBe(0)
      expect(row.progressPct).toBeNull()
    }
  })

  it('완료·진행 블록 수가 분모를 넘지 않는다', () => {
    for (const factory of ROSTER_PAINTING_FACTORIES) {
      for (const row of paintingStepRollup(paintingCollectionOf(factory, BASE_DATE))) {
        expect(row.done + row.inProgress).toBeLessThanOrEqual(row.blocks)
      }
    }
  })
})

describe('기준일', () => {
  it('로컬 날짜를 쓴다 — UTC 로 밀려 어제가 되지 않는다', () => {
    expect(todayString(new Date(2026, 8, 3, 0, 30))).toBe('2026-09-03')
    expect(todayString(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09')
  })
})
