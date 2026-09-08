import { describe, expect, it } from 'vitest'
import { assemblyBayKeyOfLocationId } from '../mapEntry'
import { REAL_FACTORY_ID, REAL_LOCATION_ID } from '../../api/realScanData'

/*
 * **정반 → 설비 베이 키** — 정반을 보다가 '현황' 으로 건너올 때 자리를 잇는 값.
 *
 * 설비 fixture 의 `bay`, 야드 지번의 `bay`, 현황 보드의 구획 키가 모두 같은 어휘를
 * 쓴다(`"5"`). 그 어휘로 옮기는 자리가 여기 하나뿐이라, 규약(`{factoryId}-b{bayNo}`)이
 * 바뀌면 여기서 한 번에 걸린다.
 */
describe('정반 → 설비 베이 키', () => {
  it('규약대로 된 id 에서 베이 번호를 낸다', () => {
    expect(assemblyBayKeyOfLocationId('asm-pbs', 'asm-pbs-b5')).toBe('5')
    expect(assemblyBayKeyOfLocationId('asm-pbs', 'asm-pbs-b12')).toBe('12')
  })

  it('실측 정반(PBS 5BAY)도 같은 규약을 탄다 — 화면이 특수 취급하지 않는다', () => {
    expect(assemblyBayKeyOfLocationId(REAL_FACTORY_ID, REAL_LOCATION_ID)).toBe('5')
  })

  it('규약 밖이면 null — 억지로 잘라 내지 않는다', () => {
    /* 다른 공장의 id, 빈 문자열(정반을 안 고른 상태), 접두사만 있는 값 */
    expect(assemblyBayKeyOfLocationId('asm-pbs', 'asm-gbs-b5')).toBeNull()
    expect(assemblyBayKeyOfLocationId('asm-pbs', '')).toBeNull()
    expect(assemblyBayKeyOfLocationId('asm-pbs', 'asm-pbs-b')).toBeNull()
  })
})
