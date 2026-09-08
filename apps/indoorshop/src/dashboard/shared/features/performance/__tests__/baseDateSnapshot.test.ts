import { describe, expect, it } from 'vitest'
import {
  fetchAssemblySummary,
  fetchCollectionEvents,
  fetchFabricationStages,
  generateParts,
  generatePaintingSteps,
} from '../api/performanceApi'
import { aggregateStages } from '../model/aggregate'
import { FAB_STAGES } from '../model/types'
import { shiftDate, todayString, windowOf, selectionOfPreset } from '../lib/baseDate'
import { eventDateOf } from '../lib/eventWindow'

/**
 * **기준일 스냅샷의 불변식** (W7-2) — 과거를 조회했을 때 그날의 화면이 서는가.
 *
 * 기준일 조회의 값은 "그날 화면을 다시 세운다"는 데 있다. 그 약속이 깨지는 방식은 둘이고
 * 여기서 둘 다 막는다:
 *
 *  ① **미래 누설** — 기준일 이후에 일어난 일이 섞인다. 그러면 그건 그날의 화면이 아니라
 *     오늘의 화면에 과거 날짜만 적어 둔 것이다.
 *  ② **역행** — 과거 시점이 오늘보다 더 진척돼 보인다. 실적은 시간이 지나면 늘지 줄지
 *     않으므로, 어제 스냅샷이 오늘보다 앞서면 데이터가 거짓말을 하는 것이다.
 *
 * 오늘을 옮길 수 없으므로(생성기가 실제 오늘을 기준으로 되돌린다) 기준일 쪽을 옮겨
 * 검사한다. 그래서 이 파일의 기준은 `todayString()` 이다 — 어느 날 돌려도 같은 성질이
 * 성립해야 하고, 성립하지 않으면 그것이 곧 결함이다.
 */
const TODAY = todayString()
const BLOCKS: readonly (readonly [string, string])[] = [
  ['7004', '222'],
  ['7004', '310'],
  ['7012', '118'],
  ['8103', '105'],
  ['2543', '141'], // 도장 재공 — 시간축이 과거로 밀려 있는 표본
  ['2543', '660'], // 도장 갓 반입 — 이력이 거의 없는 표본
]

describe('① 미래 누설 금지 — 기준일 이후 이벤트는 보이지 않는다', () => {
  it('어느 행도 기준일보다 뒤에 일어나지 않는다', async () => {
    /* 위반을 모아서 한 번에 낸다 — 첫 위반에서 멈추면 "하나 고쳤더니 또 하나" 가 된다 */
    const leaks: string[] = []
    for (const daysBack of [0, 1, 7, 30]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const [projNo, blockNo] of BLOCKS) {
        for (const row of await fetchCollectionEvents(projNo, [blockNo], 'all', base)) {
          const at = eventDateOf(row)
          if (at == null) continue // 미도래 행 — 날짜가 없다
          if (at > base) leaks.push(`${projNo}-${blockNo} ${row.id}: ${at} > 기준일 ${base}`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('완료일도 기준일을 넘지 않는다 — 넘는 행은 그날 진행 중이었다', async () => {
    const base = shiftDate(TODAY, -3)
    for (const [projNo, blockNo] of BLOCKS) {
      for (const row of await fetchCollectionEvents(projNo, [blockNo], 'all', base)) {
        if (row.completed) expect(row.completed.date <= base).toBe(true)
        /* 완료가 지워진 행은 완료 상태로 남아 있으면 안 된다 */
        if (row.status === 'done') expect(row.completed).not.toBeNull()
      }
    }
  })

  it('좁힌 창은 창 앞의 행도 자른다 — 지난 7일을 골랐으면 그 이레만 보인다', async () => {
    const window = windowOf(selectionOfPreset('last7', TODAY))
    for (const [projNo, blockNo] of BLOCKS) {
      const rows = await fetchCollectionEvents(projNo, [blockNo], 'all', TODAY, window)
      for (const row of rows) {
        const at = eventDateOf(row)
        if (at == null) continue
        expect(at >= window.from && at <= window.to).toBe(true)
      }
    }
  })

  it('창을 좁히면 행이 늘지 않는다 — 좁힌 조회가 더 많이 보이는 일은 없다', async () => {
    const narrow = windowOf(selectionOfPreset('last7', TODAY))
    for (const [projNo, blockNo] of BLOCKS) {
      const all = await fetchCollectionEvents(projNo, [blockNo], 'all', TODAY)
      const some = await fetchCollectionEvents(projNo, [blockNo], 'all', TODAY, narrow)
      expect(some.length).toBeLessThanOrEqual(all.length)
    }
  })
})

describe('② 역행 금지 — 과거 스냅샷이 오늘보다 앞서지 않는다', () => {
  it('가공 절점: 기준일이 과거일수록 완료 부재가 줄어든다(늘지 않는다)', async () => {
    for (const [projNo, blockNo] of BLOCKS) {
      let previousDone = Number.POSITIVE_INFINITY
      for (const daysBack of [0, 3, 7, 14, 30]) {
        const parts = generateParts(projNo, blockNo, shiftDate(TODAY, -daysBack))
        const done = parts.filter((p) => p.statuses.S1 === 'done').length
        expect(done).toBeLessThanOrEqual(previousDone)
        previousDone = done
      }
    }
  })

  it('가공 중량 실적률도 과거로 갈수록 단조 감소한다', async () => {
    for (const [projNo, blockNo] of BLOCKS) {
      let previous = Number.POSITIVE_INFINITY
      for (const daysBack of [0, 5, 15, 40]) {
        const summary = await fetchFabricationStages(projNo, blockNo, shiftDate(TODAY, -daysBack))
        expect(summary.overallWeightRate).toBeLessThanOrEqual(previous + 1e-9)
        previous = summary.overallWeightRate
      }
    }
  })

  it('충분히 먼 과거는 착수 전에 가깝다 — 그날 이 블록은 아직 시작도 안 했다', async () => {
    const longAgo = shiftDate(TODAY, -60)
    for (const [projNo, blockNo] of BLOCKS) {
      const summary = aggregateStages(generateParts(projNo, blockNo, longAgo))
      /* 사다리의 마지막 절점 — 그날 이 블록은 최종 불출까지 간 부재가 하나도 없었다 */
      const last = summary.stages.find((s) => s.stage === 'S10')!
      expect(last.doneCount).toBe(0)
    }
  })
})

describe('③ 공정 순서 정합 — 되감을 때 세 권역이 함께 되감긴다', () => {
  /*
   * 한 권역만 되감으면 어느 날에도 있을 수 없는 화면이 나온다 — "가공 0% 인데 조립 완료",
   * "조립 미완인데 도장 중". 로스터의 공정 권역은 **오늘**의 사실이라, 과거 기준일에서는
   * 그날 실제로 그 단계까지 갔는지를 실적으로 다시 물어야 한다.
   */
  it('조립이 안 끝났으면 검사장으로 나가 있지 않다', async () => {
    for (const daysBack of [0, 10, 30, 60]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const [projNo, blockNo] of BLOCKS) {
        const asm = await fetchAssemblySummary(projNo, blockNo, base)
        if (asm.assyDone < asm.assyTotal) {
          expect(`${projNo}-${blockNo}@${base} moved=${asm.inspectionMoved}`).toBe(
            `${projNo}-${blockNo}@${base} moved=false`
          )
        }
      }
    }
  })

  it('조립이 안 끝났으면 도장에 반입돼 있지 않다 — 공정 순서는 되감아도 순서다', async () => {
    for (const daysBack of [0, 10, 30, 60]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const [projNo, blockNo] of BLOCKS) {
        const asm = await fetchAssemblySummary(projNo, blockNo, base)
        const pnt = generatePaintingSteps(projNo, blockNo, base)
        if (!asm.inspectionMoved) {
          expect(`${projNo}-${blockNo}@${base} ${pnt.phase}`).toBe(
            `${projNo}-${blockNo}@${base} beforeIn`
          )
          expect(pnt.doneSteps).toBe(0)
        }
      }
    }
  })

  it('충분히 먼 과거에는 어느 블록도 도장에 있지 않다 — 그날 이 배는 거기까지 안 왔다', () => {
    const longAgo = shiftDate(TODAY, -90)
    for (const [projNo, blockNo] of BLOCKS) {
      expect(generatePaintingSteps(projNo, blockNo, longAgo).phase).toBe('beforeIn')
    }
  })

  it('조립 판별도 과거로 갈수록 단조 감소한다', async () => {
    for (const [projNo, blockNo] of BLOCKS) {
      let previous = Number.POSITIVE_INFINITY
      for (const daysBack of [0, 5, 15, 40]) {
        const asm = await fetchAssemblySummary(projNo, blockNo, shiftDate(TODAY, -daysBack))
        expect(asm.assyDone).toBeLessThanOrEqual(previous)
        previous = asm.assyDone
      }
    }
  })

  it('도장 스텝 완료도 과거로 갈수록 단조 감소한다', () => {
    for (const [projNo, blockNo] of BLOCKS) {
      let previous = Number.POSITIVE_INFINITY
      for (const daysBack of [0, 5, 15, 40]) {
        const done = generatePaintingSteps(projNo, blockNo, shiftDate(TODAY, -daysBack)).doneSteps
        expect(done).toBeLessThanOrEqual(previous)
        previous = done
      }
    }
  })
})

describe('과거 스냅샷도 규칙을 지킨다 — 되돌린 것이 모델을 깨지 않는다', () => {
  it('선행 단계 미완료 부재가 후행 단계에 착수하지 않는다 (IPD-S04 순차 규칙)', () => {
    for (const daysBack of [0, 4, 11, 25]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const [projNo, blockNo] of BLOCKS) {
        for (const part of generateParts(projNo, blockNo, base)) {
          const applicable = FAB_STAGES.filter((s) => part.statuses[s] !== 'excluded')
          let seenUnfinished = false
          for (const stage of applicable) {
            const status = part.statuses[stage]
            if (seenUnfinished) expect(status).not.toBe('done')
            if (status !== 'done') seenUnfinished = true
          }
        }
      }
    }
  })

  it('미대상 부재는 기준일이 바뀌어도 미대상이다 — 시간이 대상 여부를 바꾸지 않는다', () => {
    for (const [projNo, blockNo] of BLOCKS) {
      const today = generateParts(projNo, blockNo, TODAY)
      const past = generateParts(projNo, blockNo, shiftDate(TODAY, -20))
      expect(past.map((p) => p.partNo)).toEqual(today.map((p) => p.partNo))
      for (let i = 0; i < today.length; i += 1) {
        for (const stage of FAB_STAGES) {
          expect(past[i].statuses[stage] === 'excluded').toBe(
            today[i].statuses[stage] === 'excluded'
          )
        }
      }
    }
  })

  it('같은 기준일이면 같은 결과 — 결정론은 시간축을 넣어도 유지된다', () => {
    const base = shiftDate(TODAY, -9)
    expect(generateParts('7004', '222', base)).toEqual(generateParts('7004', '222', base))
  })
})

describe('기본값은 오늘 — 기존 호출부 무변경', () => {
  it('기준일을 넘기지 않은 호출은 오늘을 넘긴 것과 같다', () => {
    expect(generateParts('7004', '222')).toEqual(generateParts('7004', '222', TODAY))
  })

  it('가공 seam 도 마찬가지다', async () => {
    expect(await fetchFabricationStages('7004', '222')).toEqual(
      await fetchFabricationStages('7004', '222', TODAY)
    )
  })

  it('조립·도장도 오늘 기준에서는 되감기 0 이다 — 지금까지의 화면이 그대로다', async () => {
    for (const [projNo, blockNo] of BLOCKS) {
      const asm = await fetchAssemblySummary(projNo, blockNo, TODAY)
      /* 로스터가 의장·도장으로 적은 블록은 오늘 기준에서 조립이 전량 완료다 */
      if (['2543', '7012'].includes(projNo) && ['141', '660'].includes(blockNo)) {
        expect(asm.assyDone).toBe(asm.assyTotal)
        expect(asm.inspectionMoved).toBe(true)
      }
    }
  })

  it('창을 주지 않은 그리드 조회는 기준일까지 열린 창과 같다', async () => {
    const withoutWindow = await fetchCollectionEvents('7004', ['222'], 'all', TODAY)
    const wideWindow = await fetchCollectionEvents('7004', ['222'], 'all', TODAY, {
      from: '0000-01-01',
      to: TODAY,
    })
    expect(withoutWindow).toEqual(wideWindow)
  })
})

describe('도장 일일공정률 이력 — 스파크라인의 재료', () => {
  it('진행 중 스텝의 이력은 오래된 날부터 단조 증가한다', () => {
    for (const [projNo, blockNo] of BLOCKS) {
      const summary = generatePaintingSteps(projNo, blockNo, TODAY)
      for (const step of summary.steps) {
        const history = step.progressHistory
        for (let i = 1; i < history.length; i += 1) {
          expect(history[i].date > history[i - 1].date).toBe(true)
          expect(history[i].rate).toBeGreaterThanOrEqual(history[i - 1].rate)
        }
      }
    }
  })

  it('이력의 마지막 점이 그 스텝의 근거 날짜(progressAsOf)와 같다', () => {
    for (const [projNo, blockNo] of BLOCKS) {
      for (const step of generatePaintingSteps(projNo, blockNo, TODAY).steps) {
        if (step.progressHistory.length === 0) continue
        expect(step.progressHistory.at(-1)!.date).toBe(step.progressAsOf)
      }
    }
  })

  it('이력은 기준일을 넘지 않는다 — 등록이 하루 1회 일괄이라 최신이 어제다', () => {
    const base = shiftDate(TODAY, -2)
    for (const [projNo, blockNo] of BLOCKS) {
      for (const step of generatePaintingSteps(projNo, blockNo, base).steps) {
        for (const point of step.progressHistory) expect(point.date < base).toBe(true)
      }
    }
  })

  it('완료·미착수 스텝에는 이력이 없다 — 없는 추이를 그리지 않는다', () => {
    for (const [projNo, blockNo] of BLOCKS) {
      for (const step of generatePaintingSteps(projNo, blockNo, TODAY).steps) {
        if (step.status !== 'inProgress') expect(step.progressHistory).toEqual([])
      }
    }
  })
})
