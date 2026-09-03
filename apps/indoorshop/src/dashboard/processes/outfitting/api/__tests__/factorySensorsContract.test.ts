import { describe, expect, it } from 'vitest'
import { fetchSensors, fetchFactories } from '../outfittingApi'
import { YARD_EQUIPMENT } from '../../../../shared/entities/equipment'

/**
 * **공장 현황·목록의 센서도 이관된 실제 설비다** (W7-6V 검증 자산 — 감사 O5).
 *
 * 감사에서 같은 라이다가 지도 패널에서는 `LD-0101`, 공장 현황에서는 `P11B-L1` 로 불렸다
 * (한 설비 두 이름 — 어느 것이 그것인지 화면을 오가며 다시 판단해야 한다). W7-6E 가
 * `fetchSensors` 를 이관 설비로 돌렸지만, 그 계약(blockUnitContract)은 **베이 3D 장면의
 * 센서만** 본다 — 공장 현황이 쓰는 `fetchSensors` 경로는 검사 밖이었다. 여기서 못 박는다.
 *
 * fetchSensors 에는 "설비가 닿지 않은 공장은 예전 목업으로 물러난다" 는 폴백이 남아
 * 있다 — 그 폴백이 실제로 밟히면 지어낸 `{구역}-L1` 이름이 되살아나므로, 전 공장에서
 * 폴백이 죽은 경로임을 함께 확인한다.
 */
describe('의장 공장 센서 — 한 라이다 한 이름 (O5)', () => {
  it('모든 공장의 fetchSensors 가 이관된 LD-* 설비만 낸다 — 지어낸 {구역}-L1 이 없다', async () => {
    const factories = await fetchFactories()
    expect(factories.length).toBeGreaterThan(0)

    const known = new Set(YARD_EQUIPMENT.map((e) => e.id))
    for (const factory of factories) {
      const sensors = await fetchSensors(factory.id)
      expect(sensors.length, `${factory.name}: 센서 0 이면 폴백(목업)이 밟힌 것`).toBeGreaterThan(0)
      for (const sensor of sensors) {
        expect(sensor.name).not.toMatch(/-L\d+$/)
        expect(sensor.id.startsWith('LD-'), `${factory.name}: ${sensor.id}`).toBe(true)
        expect(known.has(sensor.id), `${factory.name}: ${sensor.id} 는 설비 엔티티에 실재해야`).toBe(
          true
        )
      }
    }
  })

  it('센서 이름과 ID 가 같다 — 설비 상태 화면과 같은 이름으로 부른다', async () => {
    const factories = await fetchFactories()
    for (const factory of factories) {
      for (const sensor of await fetchSensors(factory.id)) {
        expect(sensor.name).toBe(sensor.id)
      }
    }
  })
})
