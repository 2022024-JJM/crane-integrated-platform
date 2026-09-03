import type { Factory, FactoryHealth } from '../../../shared/entities/factory/model/types'
import type {
  OutfittingBlock,
  OutfittingBlockStatus,
  OutfittingSensor,
  OutfittingSensorStatus,
} from '../model/block'
import { blocksAtOutfittingFactory } from '../../../shared/entities/vessel'
import { OUTFITTING_FACTORIES } from './outfittingFactoryFixture'

/**
 * 선행의장 mock 데이터 (블록 중심).
 *
 * 공장 7곳과 구역 골격은 painting 야드 지번 데이터에서 파생한 실데이터
 * (`outfittingFactoryFixture.ts`)이고, **어느 블록이 어느 구역에 있는지는 로스터**
 * (`shared/entities/vessel`)가 정한다 — 의장에서 본 블록이 통합실적·대시보드에서도
 * 같은 이름으로 나오게 하는 연결점이다. 그 위에 얹는 상태·진척·센서만 실측 파이프라인이
 * 아직 없어 **해시 결정론 mock** 으로 채운다 — 렌더링마다 값이 흔들리지 않는다.
 * 실연동 시 이 파일 대신 실제 조회를 `outfittingApi` 함수 몸통에 넣으면 되고, 공장/구역
 * 구조는 fixture 재생성으로 갱신한다.
 */

/** 문자열 기반 결정적 의사난수 — 모듈 안의 다른 mock(베이 장면 등)도 같은 해시를 쓴다 */
export function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

const WSTG_POOL = ['E11', 'E12', 'E21', 'U21', 'U22', 'D31', 'D32', 'P41']

/** 스캔 시각 — 결정론적 13:00~15:59 */
function scanTimeOf(seed: string): string {
  const h = 13 + (hashOf(`${seed}-h`) % 3)
  const m = hashOf(`${seed}-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 진척률 → 상태 (경계 결정론) */
function statusOf(progress: number): OutfittingBlockStatus {
  if (progress >= 100) return 'completed'
  if (progress < 15) return 'waiting'
  return 'in_progress'
}

export const mockFactories: Factory[] = OUTFITTING_FACTORIES.map((factory): Factory => {
  const seed = hashOf(`${factory.id}-health`)
  /* 대부분 정상, 일부만 주의 — 결정론적으로 고정 */
  const health: FactoryHealth = seed % 5 === 0 ? 'degraded' : 'healthy'
  return {
    id: factory.id,
    name: factory.name,
    displayName: factory.name,
    assyShop: factory.shopCode,
    locationCount: factory.areas.length,
    health,
  }
})

/**
 * 블록 — **로스터가 정한 것만** 선다 (`shared/entities/vessel`).
 *
 * 전에는 구역마다 지번 수에 비례해 1~3개를 즉석에서 지어냈다. 그 호선번호(5510·2698…)와
 * 블록번호는 이 화면 밖 어디에도 없어서, 의장에서 본 블록을 통합실적에서 조회할 수도
 * 대시보드에서 찾을 수도 없었다. 지금은 로스터의 의장 배정(`outfitting.areaCode`)이
 * 곧 이 목록이고, 여기서 만드는 것은 진척·상태·스캔시각뿐이다 — 실측 파이프라인이
 * 아직 없는 값들만 mock 이다.
 *
 * 시드는 `projNo-blockNo` — 자리(구역 인덱스)가 아니라 **블록의 신원**이다. 로스터에서
 * 블록의 구역이 바뀌어도 그 블록의 진척은 따라간다.
 */
export const mockBlocks: OutfittingBlock[] = OUTFITTING_FACTORIES.flatMap((factory) => {
  const areaOf = new Map(factory.areas.map((area) => [area.code, area]))
  return blocksAtOutfittingFactory(factory.id).flatMap((block, i): OutfittingBlock[] => {
    const area = areaOf.get(block.outfitting!.areaCode)
    /* 로스터가 가리키는 구역이 fixture 에 없으면 그 블록은 세우지 않는다 —
     * 없는 자리에 그리느니 빠지는 편이 낫다(공장 뷰와 어긋나지 않게). */
    if (!area) return []
    const seed = `${block.projNo}-${block.blockNo}`
    const h = hashOf(seed)
    /* 진척: 12%는 대기(0~12), 18%는 완료(100), 나머지는 진행중(20~95) */
    const bucket = h % 100
    const progress = bucket < 12 ? h % 13 : bucket >= 82 ? 100 : 20 + (hashOf(`${seed}-p`) % 76)
    return [
      {
        id: `${factory.id}-b${String(i + 1).padStart(2, '0')}-${area.code.toLowerCase()}`,
        factoryId: factory.id,
        areaCode: area.code,
        areaName: area.name,
        projNo: block.projNo,
        blkNo: block.blockNo,
        wstgCode: WSTG_POOL[hashOf(`${seed}-w`) % WSTG_POOL.length],
        status: statusOf(progress),
        progress,
        lastScanAt: scanTimeOf(seed),
      },
    ]
  })
})

/**
 * LiDAR 센서 — 구역마다 1~2대. 대부분 online, 결정론적으로 소수만 offline/error.
 */
export const mockSensors: OutfittingSensor[] = OUTFITTING_FACTORIES.flatMap((factory) =>
  factory.areas.flatMap((area) => {
    const count = area.yardLots.length >= 4 ? 2 : 1
    return Array.from({ length: count }, (_, i): OutfittingSensor => {
      const seed = `${factory.id}-${area.code}-s${i}`
      const h = hashOf(seed)
      /* 12% offline, 6% error, 나머지 online */
      const roll = h % 100
      const status: OutfittingSensorStatus =
        roll < 12 ? 'offline' : roll < 18 ? 'error' : 'online'
      return {
        id: seed,
        factoryId: factory.id,
        name: `${area.code}-L${i + 1}`,
        areaName: area.name,
        status,
        lastScanAt: status === 'online' ? scanTimeOf(seed) : scanTimeOf(`${seed}-old`),
      }
    })
  })
)
