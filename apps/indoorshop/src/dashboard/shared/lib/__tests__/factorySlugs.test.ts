import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../entities/yard-parcels'
import { FACTORY_BY_SLUG, factoryNameOfSlug, factorySlugOf } from '../factorySlugs'

/*
 * 슬러그 표의 온전성 (F-30) — 표는 손으로 관리하는 스냅샷이라, 지도에 새 공장이 서면
 * 여기가 빨개져서 "표에 한 줄을 더하라"고 말해야 한다.
 */
describe('공장 슬러그 표', () => {
  it('지도(지번 fixture)의 모든 공장이 표에 있다 — 새 공장은 표에 한 줄을 더할 것', async () => {
    const parcels = await loadYardParcels()
    const missing = parcels.factories.map((f) => f.name).filter((name) => !factorySlugOf(name))
    expect(missing, `슬러그 없는 공장: ${missing.join(', ')}`).toEqual([])
  })

  it('슬러그는 유일하고 왕복한다', () => {
    const slugs = Object.keys(FACTORY_BY_SLUG)
    expect(new Set(Object.values(FACTORY_BY_SLUG)).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(factorySlugOf(factoryNameOfSlug(slug)!)).toBe(slug)
    }
  })

  it('슬러그는 URL 에 그대로 실을 수 있는 ASCII 다 — 인코딩 취약(F-30)의 해소 조건', () => {
    for (const slug of Object.keys(FACTORY_BY_SLUG)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
      expect(encodeURIComponent(slug)).toBe(slug)
    }
  })

  it('공정 모듈의 라우트 id 와 같은 어휘다 — 경로 조각과 쿼리 값이 한 체계', () => {
    expect(factorySlugOf('GBS')).toBe('asm-gbs')
    expect(factorySlugOf('POS 1공장')).toBe('ofit-pos1')
    expect(factorySlugOf('1DOCK 도장공장')).toBe('pnt-1dock')
  })
})
