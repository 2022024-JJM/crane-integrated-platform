import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { YARD_EQUIPMENT } from '../shared/entities/equipment'
import { setRealScanAssetFetcher } from '../processes/assembly/api/realScanAssets'
import { fetchFactoryOverviews, fetchLidarSensors, fetchLocations } from '../processes/assembly/api/assemblyApi'
import { REAL_LOCATION_ID } from '../processes/assembly/api/realScanData'
import { fetchFactories, fetchSensors } from '../processes/outfitting/api/outfittingApi'
import { outfittingDevices, outfittingFactoryNames } from '../processes/outfitting/lib/equipmentStatus'

/**
 * **화면에 서는 센서 이름은 설비 fixture 에 실재한다** (연계 매트릭스 Top4).
 *
 * 감사에서 같은 라이다가 세 이름으로 불렸다 — 지도 마커는 `LD-P01`, 조립 정반 카드는
 * `센서 3`, 의장 공장 현황은 `P11B-L1`. 세 우주는 각각 자기 mock 에서 났고, 화면을
 * 오갈 때마다 "저 센서가 이 센서인가"를 사람이 다시 판단해야 했다.
 *
 * 이제 원천은 `shared/entities/equipment` 하나다. 그 사실을 화면이 실제로 부르는 함수
 * 경로에서 확인한다 — mock 파일을 들여다보는 것이 아니라, 조립·의장이 화면에 내려보내는
 * 값을 그대로 받아 검사한다.
 *
 * ⚠️ 예외 하나: 실측 정반(PBS 5BAY)의 센서 이름은 스캐너의 **실제 IP**다(실측 자산이 준
 * 값이라 지어낸 이름이 아니다). ID↔IP 대응표가 아직 없어 설비ID 로 옮기지 못한다 —
 * 예외를 규칙 안에 적어 두고, 그 자리가 늘어나지 않는지 함께 지킨다.
 */

/** 실측 자산 통로를 파일 읽기로 갈아 끼운다 — 노드에는 상대 경로를 풀 기준이 없다 */
beforeAll(() => {
  setRealScanAssetFetcher(async (path) => {
    const raw = readFileSync(new URL(`../../../../shell/public/real-scan/${path}`, import.meta.url))
    /* 실측 매니페스트는 UTF-8 이 아닌 바이트를 품고 있다 — 이름만 읽으면 되므로 관대하게 */
    return JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(raw))
  })
})
afterAll(() => {
  setRealScanAssetFetcher(null)
})

/** 정반별 센서를 한 번에 — mock 지연이 정반 수만큼 곱해지지 않게 병렬로 받는다 */
async function sensorsOf(
  locations: readonly { id: string }[]
): Promise<[{ id: string }, Awaited<ReturnType<typeof fetchLidarSensors>>][]> {
  const lists = await Promise.all(locations.map((location) => fetchLidarSensors(location.id)))
  return locations.map((location, i) => [location, lists[i]])
}

const KNOWN_EQUIPMENT = new Set(YARD_EQUIPMENT.map((e) => e.id))
const LIDAR_IDS = new Set(
  YARD_EQUIPMENT.filter((e) => e.typeId === 'LIDAR').map((e) => e.id)
)
/** 지어낸 이름의 흔적 — 되살아나면 여기서 걸린다 */
const INVENTED_NAME = /^센서 \d+$|-L\d+$|^Sensor \d+$/
/** 실측 스캐너 주소 (IPv4) — 규칙 안에 적어 둔 유일한 예외 */
const SCANNER_IP = /^\d{1,3}(\.\d{1,3}){3}$/

describe('조립 — 정반 센서는 이관 설비다', () => {
  it('모든 정반의 센서 ID·이름이 설비 fixture 의 라이다다 (실측 정반 제외)', async () => {
    const locations = await fetchLocations()
    const offenders: string[] = []
    const sensorsByLocation = await sensorsOf(locations)
    for (const [location, sensors] of sensorsByLocation) {
      if (location.id === REAL_LOCATION_ID) continue
      for (const sensor of sensors) {
        if (!LIDAR_IDS.has(sensor.id)) offenders.push(`${location.id}: id=${sensor.id}`)
        if (sensor.name !== sensor.id) offenders.push(`${location.id}: name=${sensor.name}`)
        if (INVENTED_NAME.test(sensor.name)) offenders.push(`${location.id}: 지어낸 이름 ${sensor.name}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("'센서 N' 이름이 한 대도 없다 — 148대 목업이 되살아나지 않는다", async () => {
    const names: string[] = []
    for (const [, sensors] of await sensorsOf(await fetchLocations())) {
      for (const sensor of sensors) names.push(sensor.name)
    }
    expect(names.filter((name) => /^센서 \d+$/.test(name))).toEqual([])
    expect(names.length).toBeGreaterThan(100)
  })

  it('센서가 선 정반은 그 정반의 (공장,베이) 설비만 세운다 — 남의 베이를 끌어오지 않는다', async () => {
    const byId = new Map(YARD_EQUIPMENT.map((e) => [e.id, e]))
    for (const [location, sensors] of await sensorsOf(await fetchLocations())) {
      if (location.id === REAL_LOCATION_ID) continue
      const bayNo = location.id.split('-b').at(-1)
      for (const sensor of sensors) {
        expect(byId.get(sensor.id)?.bay, `${location.id}: ${sensor.id}`).toBe(bayNo)
      }
    }
  })

  it('실측 정반만 예외다 — 그 이름은 스캐너 IP(실측 자산이 준 값)', async () => {
    const sensors = await fetchLidarSensors(REAL_LOCATION_ID)
    expect(sensors.length).toBeGreaterThan(0)
    for (const sensor of sensors) {
      expect(SCANNER_IP.test(sensor.name), `${sensor.name} 는 IP 여야 한다`).toBe(true)
    }
  })
})

describe('조립 — 공장 집계도 같은 원천을 센다 (실측 자산 seam)', () => {
  it('집계가 노드에서 실행된다 — 주입 통로가 열려 있다', async () => {
    const overviews = await fetchFactoryOverviews()
    expect(overviews.length).toBeGreaterThan(0)
  })

  it('공장 카드의 센서 대수 합이 그 공장의 설비 라이다 대수와 같다', async () => {
    const overviews = await fetchFactoryOverviews()
    for (const overview of overviews) {
      /* 실측 정반은 실측 자산이 센서를 세므로 이 대조에서 뺀다 */
      const counted = overview.bays
        .filter((bay) => bay.locationId !== REAL_LOCATION_ID)
        .reduce((sum, bay) => sum + bay.sensorTotal, 0)
      const fromEquipment = YARD_EQUIPMENT.filter(
        (e) =>
          e.typeId === 'LIDAR' &&
          e.factory === overview.factory.name &&
          overview.bays.some(
            (bay) => bay.locationId !== REAL_LOCATION_ID && bay.locationId.endsWith(`-b${e.bay}`)
          )
      ).length
      expect(counted, overview.factory.name).toBe(fromEquipment)
    }
  })
})

describe('의장 — 공장 현황·설비 목록도 이관 설비다', () => {
  it('fetchSensors 가 설비 라이다만 낸다', async () => {
    const factories = await fetchFactories()
    const lists = await Promise.all(factories.map((f) => fetchSensors(f.id)))
    for (const [i, factory] of factories.entries()) {
      for (const sensor of lists[i]) {
        expect(LIDAR_IDS.has(sensor.id), `${factory.name}: ${sensor.id}`).toBe(true)
        expect(sensor.name).toBe(sensor.id)
        expect(INVENTED_NAME.test(sensor.name)).toBe(false)
      }
    }
  })

  it("목업 자리 폴백이 사라졌다 — '{구역}-L1' 27대가 되살아나지 않는다", () => {
    const names = outfittingFactoryNames().flatMap((factory) =>
      outfittingDevices(factory).map((device) => device.id)
    )
    expect(names.filter((name) => /-L\d+$/.test(name))).toEqual([])
    for (const name of names) expect(KNOWN_EQUIPMENT.has(name)).toBe(true)
  })
})

describe('한 설비 한 이름 — 공정을 가로질러', () => {
  it('조립·의장이 같은 설비를 같은 이름으로 부른다 (교집합이 비지 않고, 이름이 곧 ID)', async () => {
    const asmNames = new Set<string>()
    for (const [location, sensors] of await sensorsOf(await fetchLocations())) {
      if (location.id === REAL_LOCATION_ID) continue
      for (const sensor of sensors) asmNames.add(sensor.name)
    }
    const ofitNames = new Set<string>()
    const factories = await fetchFactories()
    for (const list of await Promise.all(factories.map((f) => fetchSensors(f.id)))) {
      for (const sensor of list) ofitNames.add(sensor.name)
    }
    expect(asmNames.size).toBeGreaterThan(0)
    expect(ofitNames.size).toBeGreaterThan(0)
    /* 두 목록 모두 같은 우주(설비 fixture)의 부분집합이다 */
    for (const name of [...asmNames, ...ofitNames]) expect(LIDAR_IDS.has(name)).toBe(true)
    /* 공정이 다르므로 겹치지는 않는다 — 그래도 우주는 하나다 */
    const overlap = [...asmNames].filter((name) => ofitNames.has(name))
    expect(overlap).toEqual([])
  })
})
