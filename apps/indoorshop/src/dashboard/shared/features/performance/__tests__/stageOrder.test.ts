import { describe, expect, it } from 'vitest'
import { generateAssyUnits, generatePaintingSteps } from '../api/performanceApi'
import { isBlockInTransition, listBlocks } from '../../../entities/vessel'

/*
 * **공정 순서 정합 불변식** (W6-2, 사용자 지적).
 *
 * 순서는 가공 → 조립 → (선행)의장 → 도장이다. 더미가 조립 수위를 해시로만 뽑던 탓에
 * "의장 공장에 서 있는데 조립 0/6" · "조립 중인데 도장 작업 중" 같은 상태가 나왔다.
 * 여기서 못박는 것: **블록이 서 있는 공정이 그 앞 공정의 완료를 함의한다.**
 *
 * 전이(`justArrived`)는 그 경계에 선 표본이다 — 앞 공정을 막 끝냈고 이 공정 실적은 아직
 * 시작 전이다. 경계를 화면이 그릴 수 있어야 해서 로스터에 표본으로 둔다.
 */
const BASE = '2026-09-03'
const daysBack = (date: string) =>
  Math.round((new Date(`${BASE}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000)

describe('공정 순서 정합 — 블록 단계가 앞 공정의 완료를 함의한다', () => {
  it('의장·도장 단계 블록은 조립이 전량 완료돼 있고 검사장으로 이동했다', () => {
    let checked = 0
    for (const b of listBlocks()) {
      if (b.zone !== 'outfitting' && b.zone !== 'painting') continue
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}(${b.zone})`
      expect(asm.assyDone, where).toBe(asm.assyTotal)
      expect(asm.assyJudged, where).toBe(asm.assyTotal)
      expect(asm.inspectionMoved, where).toBe(true)
      expect(asm.inspectionDate, where).toBeTruthy()
      /* 전량 완료면 미해결 불일치가 남아 있을 수 없다 (ASM-F10 완료 처리 금지의 귀결) */
      expect(asm.match.unmatched, where).toBe(0)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('조립 단계 블록은 아직 검사장으로 가지 않았고 도장 반입 전이다', () => {
    let checked = 0
    for (const b of listBlocks()) {
      if (b.zone !== 'assembly') continue
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}`
      expect(asm.inspectionMoved, where).toBe(false)
      expect(pnt.phase, where).toBe('beforeIn')
      expect(pnt.steps.every((s) => s.status === 'notDue'), where).toBe(true)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('가공 단계 블록은 조립에 아직 착수하지 않았다', () => {
    let checked = 0
    for (const b of listBlocks()) {
      if (b.zone !== 'fabrication') continue
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}`
      expect(asm.recognizedQty, where).toBe(0)
      expect(asm.assyJudged, where).toBe(0)
      expect(asm.inspectionMoved, where).toBe(false)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('도장 phase 는 로스터 단계와 일치한다 — 의장 블록이 도장 중일 수 없다', () => {
    for (const b of listBlocks()) {
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}(${b.zone})`
      if (b.zone === 'painting') expect(pnt.phase === 'beforeIn', where).toBe(false)
      else expect(pnt.phase, where).toBe('beforeIn')
    }
  })

  it('ASSY 분산(다중 자리)은 조립 단계 블록에만 적혀 있다', () => {
    for (const b of listBlocks()) {
      if (!b.assyUnits) continue
      expect(b.zone, `${b.projNo}-${b.blockNo}`).toBe('assembly')
      for (const u of b.assyUnits) expect(u.zone, u.assyNo).toBe('assembly')
    }
  })
})

describe('단계 전이 표본 — 경계에 선 블록', () => {
  it('(a) 의장으로 막 넘어온 블록: 조립 전량 완료 + 검사장 이동이 어제', () => {
    const arrivals = listBlocks().filter((b) => isBlockInTransition(b) && b.zone === 'outfitting')
    expect(arrivals.length).toBeGreaterThan(0)
    for (const b of arrivals) {
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}`
      expect(asm.assyDone, where).toBe(asm.assyTotal)
      expect(daysBack(asm.inspectionDate!), where).toBe(1)
    }
  })

  it('(b) 도장으로 막 반입된 블록: 반입만 찍히고 스텝 미착수 — 일일공정률이 아직 없다', () => {
    const arrivals = listBlocks().filter((b) => isBlockInTransition(b) && b.zone === 'painting')
    expect(arrivals.length).toBeGreaterThan(0)
    for (const b of arrivals) {
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      const where = `${b.projNo}-${b.blockNo}`
      expect(pnt.phase, where).toBe('inShop')
      expect(pnt.btsInDate, where).toBeTruthy()
      expect(daysBack(pnt.btsInDate!), where).toBeLessThanOrEqual(2)
      expect(pnt.doneSteps, where).toBe(0)
      for (const s of pnt.steps) {
        expect(s.status, `${where} ${s.step}`).toBe('notDue')
        expect(s.progressPct, `${where} ${s.step}`).toBe(0)
        expect(s.progressAsOf, `${where} ${s.step}`).toBeNull()
      }
    }
  })

  it('전이 블록도 순서 정합을 지킨다 — 앞 공정이 끝나 있다', () => {
    for (const b of listBlocks().filter(isBlockInTransition)) {
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      expect(asm.assyDone, `${b.projNo}-${b.blockNo}`).toBe(asm.assyTotal)
      expect(asm.inspectionMoved).toBe(true)
    }
  })
})
