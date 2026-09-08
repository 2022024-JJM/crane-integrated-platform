import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNowSource } from '../shared/lib/now'
import { instantOf, rewindDaysOf, shiftDate, todayString } from '../shared/lib/timeAxis'
import { outfittingBlocksAt } from '../processes/outfitting/api/mockOutfittingData'
import { fetchFactoryOverviews as fetchOutfittingOverviews } from '../processes/outfitting/api/outfittingApi'
import { fetchDailyProduction } from '../processes/assembly/api/assemblyApi'
import { fetchFactoryEquipmentStatuses } from '../shared/entities/equipment/statusApi'

/*
 * **기준일을 되감으면 앱 전체가 같은 날을 말한다** (연계 매트릭스 §2.3 · 계약 C7).
 *
 * 예전에는 통합실적만 `?date=` 를 먹고 조립·의장·설비는 제 시계를 읽었다. 그래서 사흘
 * 전을 조회한 채 공정 화면으로 건너가면 한 앱이 두 날짜를 동시에 주장했다. 여기서 보는
 * 것은 화면이 아니라 **데이터 함수의 계약**이다 — 기준일을 넣으면 값이 그날 것이 되는가,
 * 그리고 오늘을 넣으면 지금까지와 똑같은가.
 *
 * (공정을 가로지르는 검사라 어느 레이어에도 속하지 않는 `src/__tests__` 에 둔다.)
 */

/** 매니페스트는 브라우저 자산이다 — 노드에서는 최소 형태로 세워 준다(그 로더는 이 검사의 대상이 아니다) */
function stubManifestFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        blkNo: String(url).replace(/^.*_/, '').replace('.json', ''),
        assemblies: Array.from({ length: 6 }, (_, i) => ({
          id: `A${i}`,
          wstgCode: 'E11',
          vertexCount: 5000,
          partCount: 10,
        })),
      }),
    }))
  )
}

const TODAY = '2026-09-03'
const THREE_DAYS_AGO = shiftDate(TODAY, -3)

beforeEach(() => {
  /* 시계를 못 박는다 — 이 검사는 실행한 날에 따라 달라지면 안 된다 */
  setNowSource(new Date(`${TODAY}T10:00:00`).getTime())
})

afterEach(() => {
  setNowSource(null)
  vi.unstubAllGlobals()
})

describe('시간축 seam', () => {
  it('시계를 갈아 끼우면 오늘도 함께 움직인다 — 화면이 seam 뒤에 있다는 뜻', () => {
    expect(todayString()).toBe(TODAY)
    setNowSource(new Date('2026-01-15T00:30:00').getTime())
    expect(todayString()).toBe('2026-01-15')
  })

  it('기준일이 오늘이면 되감기 0, 사흘 전이면 3', () => {
    expect(rewindDaysOf(TODAY)).toBe(0)
    expect(rewindDaysOf(THREE_DAYS_AGO)).toBe(3)
    /* 미래는 접는다 — 아직 일어나지 않은 일을 실적으로 낼 수는 없다 */
    expect(rewindDaysOf(shiftDate(TODAY, 5))).toBe(0)
  })

  it('기준일의 순간 — 오늘이면 지금, 과거면 그날의 끝', () => {
    const now = new Date(`${TODAY}T10:00:00`).getTime()
    expect(instantOf(TODAY)).toBe(now)
    expect(instantOf(THREE_DAYS_AGO)).toBe(
      new Date(`${THREE_DAYS_AGO}T23:59:59.999`).getTime()
    )
    /* 과거를 보는 화면에서 '지금'을 그대로 쓰면 하트비트만 방금이 된다 */
    expect(instantOf(THREE_DAYS_AGO)).toBeLessThan(instantOf(TODAY))
  })
})

describe('의장 — 기준일을 되감으면 진척도 되감긴다', () => {
  it('같은 블록이 사흘 전에는 오늘 이하의 진척이다', () => {
    const today = outfittingBlocksAt(TODAY)
    const past = outfittingBlocksAt(THREE_DAYS_AGO)

    expect(today.length).toBeGreaterThan(0)
    /* 블록의 신원(어디에 있는가)은 날짜와 무관하다 — 진척만 되감긴다 */
    expect(past.map((b) => b.id)).toEqual(today.map((b) => b.id))

    for (const [i, block] of past.entries()) {
      expect(block.progress).toBeLessThanOrEqual(today[i].progress)
    }
    const sumOf = (blocks: typeof today) => blocks.reduce((s, b) => s + b.progress, 0)
    expect(sumOf(past)).toBeLessThan(sumOf(today))
  })

  it('공장 집계도 그날 기준이다 — 되감으면 완료가 줄고 대기가 는다', async () => {
    const [today, past] = await Promise.all([
      fetchOutfittingOverviews(TODAY),
      fetchOutfittingOverviews(THREE_DAYS_AGO),
    ])
    const sum = (rows: typeof today, key: 'completed' | 'waiting') =>
      rows.reduce((s, r) => s + r[key], 0)

    expect(sum(past, 'completed')).toBeLessThan(sum(today, 'completed'))
    expect(sum(past, 'waiting')).toBeGreaterThan(sum(today, 'waiting'))
  })

  it('기준일을 주지 않으면 오늘 — 기존 호출부는 지금까지와 똑같이 돈다', () => {
    expect(outfittingBlocksAt().map((b) => b.progress)).toEqual(
      outfittingBlocksAt(TODAY).map((b) => b.progress)
    )
  })
})

describe('조립 — 일일 생산이 기준일의 7일 창으로 선다', () => {
  it('창의 끝이 기준일이다 (예전에는 여기서 시계를 직접 읽어 늘 오늘이었다)', async () => {
    stubManifestFetch()
    const rows = await fetchDailyProduction('asm-pbs', THREE_DAYS_AGO)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.daily).toHaveLength(7)
      expect(row.daily.at(-1)!.label).toBe('8/31')
      expect(row.daily[0].label).toBe('8/25')
    }
  })

  it('되감으면 같은 정반의 그날 건수가 오늘 것과 다른 근거로 선다', async () => {
    stubManifestFetch()
    const [today, past] = await Promise.all([
      fetchDailyProduction('asm-pbs', TODAY),
      fetchDailyProduction('asm-pbs', THREE_DAYS_AGO),
    ])
    /* 라벨(창)이 통째로 옮겨 갔는가 — 값이 우연히 같을 수는 있어도 창은 반드시 다르다 */
    expect(past[0].daily.map((d) => d.label)).not.toEqual(today[0].daily.map((d) => d.label))
  })
})

describe('설비 — 상태 스냅샷의 시각이 기준일을 따른다', () => {
  it('되감은 스냅샷은 그날의 끝에서 찍힌다', async () => {
    const factory = 'PBS'
    const past = await fetchFactoryEquipmentStatuses(factory, instantOf(THREE_DAYS_AGO))
    expect(past.at).toBe(instantOf(THREE_DAYS_AGO))
    /* 로컬 날짜로 확인한다 — toISOString 은 UTC 라 시간대에 따라 하루가 밀린다 */
    expect(todayString(new Date(past.at))).toBe(THREE_DAYS_AGO)
  })

  it('기준일을 주지 않으면 지금 — 훅이 없는 호출부의 동작은 그대로다', async () => {
    const snapshot = await fetchFactoryEquipmentStatuses('PBS')
    expect(snapshot.at).toBe(new Date(`${TODAY}T10:00:00`).getTime())
  })
})
