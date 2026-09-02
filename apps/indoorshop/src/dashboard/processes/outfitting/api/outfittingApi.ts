import type { Factory } from '../../../shared/entities/factory/model/types'
import type {
  OutfittingBlock,
  OutfittingFactoryOverview,
  OutfittingSensor,
} from '../model/block'
import { OUTFITTING_FACTORIES } from './outfittingFactoryFixture'
import { mockBlocks, mockFactories, mockSensors } from './mockOutfittingData'

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

export function fetchBlocks(factoryId: string): Promise<OutfittingBlock[]> {
  return withLatency(mockBlocks.filter((block) => block.factoryId === factoryId))
}

/**
 * 전 공장 블록 한 번에 — 맵 진입 화면이 쓴다. 베이를 누를 때마다 fetch 하면 드릴다운이
 * 그때그때 늦어지므로, 공장 목록 집계처럼 처음에 전부 받아 화면 안에서 거른다.
 */
export function fetchAllBlocks(): Promise<OutfittingBlock[]> {
  return withLatency(mockBlocks)
}

export function fetchSensors(factoryId: string): Promise<OutfittingSensor[]> {
  return withLatency(mockSensors.filter((sensor) => sensor.factoryId === factoryId))
}

/** 공장 하나의 집계 — 카드·요약이 쓰는 값 */
function overviewOf(factory: Factory): OutfittingFactoryOverview {
  const spec = OUTFITTING_FACTORIES.find((f) => f.id === factory.id)
  const blocks = mockBlocks.filter((block) => block.factoryId === factory.id)
  const sensors = mockSensors.filter((sensor) => sensor.factoryId === factory.id)
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
export function fetchFactoryOverviews(): Promise<OutfittingFactoryOverview[]> {
  return withLatency(mockFactories.map(overviewOf))
}
