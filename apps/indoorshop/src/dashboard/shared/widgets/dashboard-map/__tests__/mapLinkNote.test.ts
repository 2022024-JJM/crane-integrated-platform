import { describe, expect, it } from 'vitest'
import { mapLinkNote } from '../mapLinkNote'

/*
 * PRD §7 데이터·상태 우선순위 표 — 지도 연결이 없는 경우와 **틀린** 경우는 사용자에게
 * 다른 사실이라 화면에서도 다른 문구여야 한다. 둘 다 목록과 상세 이동은 그대로 둔다.
 */
describe('mapLinkNote — 작업 위치의 지도 연결 상태', () => {
  const known = new Set(['PB3B01', 'PB1B01'])

  it('연결 키가 지도에 있으면 아무 말도 하지 않는다 (정상)', () => {
    expect(mapLinkNote({ yardLotCodes: ['PB3B01'] }, known)).toBeNull()
  })

  it('연결 키가 아예 없으면 지도 위치 정보 없음', () => {
    expect(mapLinkNote({}, known)).toBe('dashboard.map.locationNoMapKey')
    expect(mapLinkNote({ yardLotCodes: [] }, known)).toBe('dashboard.map.locationNoMapKey')
  })

  it('키는 있는데 지도 fixture 에 그 지번이 없으면 매핑 불일치 — 아직 매핑이 안 된 것과 구분한다', () => {
    expect(mapLinkNote({ yardLotCodes: ['ZZ9Z99'] }, known)).toBe(
      'dashboard.map.locationLotMissing'
    )
  })

  it('여러 지번 중 하나만 지도에 있어도 강조할 자리가 있으므로 정상이다', () => {
    expect(mapLinkNote({ yardLotCodes: ['ZZ9Z99', 'PB1B01'] }, known)).toBeNull()
  })
})
