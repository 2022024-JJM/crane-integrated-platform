import type { Factory } from '../../../shared/entities/factory/model/types'
import type {
  OutfittingBlock,
  OutfittingFactoryOverview,
  OutfittingSensor,
} from '../model/block'
import { OUTFITTING_FACTORIES } from './outfittingFactoryFixture'
import { outfittingDevices } from '../lib/equipmentStatus'
import { mockFactories, outfittingBlocksAt } from './mockOutfittingData'
import { todayString } from '../../../shared/lib/timeAxis'

/**
 * 선행의장 모니터링 데이터 API.
 *
 * 백엔드 연동(OT-Server ↔ ISL Server 결과 전달 프로토콜)이 미확정이라 현재 구현은
 * mock(블록 중심 · 해시 결정론)을 반환한다. 실연동 시 이 파일의 함수 구현만 실제 HTTP
 * 호출로 교체하면 되고, 호출부(컴포넌트)는 수정이 필요 없다.
 */

const MOCK_LATENCY_MS = 150

function withLatency<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS))
}

/** 'HH:MM' 중 더 늦은 것 — 같은 날 안이면 사전순이 곧 시간순 */
function laterTime(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

export function fetchFactories(): Promise<Factory[]> {
  return withLatency(mockFactories)
}

/** 한 공장의 블록 — 기준일의 진척으로 선다(주지 않으면 오늘) */
export function fetchBlocks(
  factoryId: string,
  baseDate: string = todayString()
): Promise<OutfittingBlock[]> {
  return withLatency(outfittingBlocksAt(baseDate).filter((block) => block.factoryId === factoryId))
}

/**
 * 전 공장 블록 한 번에 — 맵 진입 화면이 쓴다. 베이를 누를 때마다 fetch 하면 드릴다운이
 * 그때그때 늦어지므로, 공장 목록 집계처럼 처음에 전부 받아 화면 안에서 거른다.
 */
export function fetchAllBlocks(baseDate: string = todayString()): Promise<OutfittingBlock[]> {
  return withLatency(outfittingBlocksAt(baseDate))
}

/**
 * 공장의 LiDAR 목록 — **도면에서 이관된 실제 설비**를 쓴다.
 *
 * 예전에는 구역마다 `P11B-L1` 같은 이름을 지어냈다. 그런데 같은 공정의 설비 상태 화면과
 * 베이 3D 뷰는 이미 이관된 `LD-0101` 을 이름으로 부르고 있다 — 한 라이다가 화면마다 다른
 * 이름을 가지면 어느 것이 그것인지 물어야 한다. 상태도 같은 출처(`equipmentLinkOf`)다.
 *
 * 설비 데이터가 닿지 않은 공장은 **빈 목록**이다. 예전에는 지어낸 `{구역}-L1` 목업으로
 * 물러났는데, 그 폴백이 곧 두 번째 이름 우주의 씨앗이었다 — 없으면 없다고 말한다.
 */
export function fetchSensors(factoryId: string): Promise<OutfittingSensor[]> {
  const spec = OUTFITTING_FACTORIES.find((factory) => factory.id === factoryId)
  const devices = spec ? outfittingDevices(spec.name).filter((d) => d.kind === 'LIDAR') : []
  return withLatency(
    devices.map(
      (device): OutfittingSensor => ({
        id: device.id,
        factoryId,
        name: device.id,
        /* 의장은 베이에서 끝난다 — 그 아래로 더 파고드는 자리를 만들지 않는다 */
        areaName: device.bay && device.bay !== '-' ? `${device.bay}BAY` : '—',
        status: device.status === 'calibrating' ? 'online' : device.status,
        lastScanAt: device.lastScanAt ?? device.lastHeartbeatAt,
      })
    )
  )
}

/** 공장 하나의 집계 — 카드·요약이 쓰는 값 (기준일의 블록으로 센다) */
function overviewOf(factory: Factory, baseDate: string): OutfittingFactoryOverview {
  const spec = OUTFITTING_FACTORIES.find((f) => f.id === factory.id)
  const blocks = outfittingBlocksAt(baseDate).filter((block) => block.factoryId === factory.id)
  /* 라이다 대수·상태는 이관된 실제 설비에서 — 목록·카드·지도가 같은 숫자를 말하도록 */
  const sensors = spec
    ? outfittingDevices(spec.name).filter((device) => device.kind === 'LIDAR')
    : []
  const sensorOnline = sensors.filter((sensor) => sensor.status === 'online').length
  return {
    factory,
    areaCount: spec?.areas.length ?? 0,
    blockTotal: blocks.length,
    inProgress: blocks.filter((block) => block.status === 'in_progress').length,
    completed: blocks.filter((block) => block.status === 'completed').length,
    waiting: blocks.filter((block) => block.status === 'waiting').length,
    sensorTotal: sensors.length,
    sensorOnline,
    sensorFault: sensors.length - sensorOnline,
    lastScanAt: blocks.reduce<string | undefined>(
      (latest, block) => laterTime(latest, block.lastScanAt),
      undefined
    ),
  }
}

/**
 * 공장 목록 화면이 쓰는 집계.
 *
 * 카드마다 따로 fetch 하면 공장 수만큼 요청이 늘고 카드가 제각기 늦게 채워진다 —
 * 목록은 한 번에 서야 하므로 여기서 블록·센서를 미리 합쳐 내려준다.
 */
export function fetchFactoryOverviews(
  baseDate: string = todayString()
): Promise<OutfittingFactoryOverview[]> {
  return withLatency(mockFactories.map((factory) => overviewOf(factory, baseDate)))
}
