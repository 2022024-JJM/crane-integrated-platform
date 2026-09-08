import type { Factory, FactoryHealth } from '../../../shared/entities/factory/model/types'
import type { OutfittingBlock, OutfittingBlockStatus } from '../model/block'
import { blocksAtOutfittingFactory } from '../../../shared/entities/vessel'
import { OUTFITTING_FACTORIES } from './outfittingFactoryFixture'
import { rewindDaysOf, todayString } from '../../../shared/lib/timeAxis'

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

/**
 * 하루에 도는 정도(%) — 블록마다 결정론 3~8%.
 * 기준일을 되감을 때 "그날엔 여기까지였다"를 계산하는 유일한 값이다.
 */
function dailyRateOf(seed: string): number {
  return 3 + (hashOf(`${seed}-rate`) % 6)
}

/**
 * 기준일의 진척 — 오늘 값에서 되감은 만큼 내린다.
 *
 * 의장 블록에는 절점 일자가 없다(실측 파이프라인이 아직 없다). 그래서 과거 기준일을
 * 표현할 방법은 통합실적과 같다 — '그날엔 여기까지였다'. 오늘이면 되감기 0이라
 * 지금까지의 값과 완전히 같고, 과거로 갈수록 단조 감소한다.
 */
function progressAt(seed: string, progressToday: number, daysBack: number): number {
  if (daysBack <= 0) return progressToday
  return Math.max(0, progressToday - daysBack * dailyRateOf(seed))
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
function buildBlocks(baseDate: string): OutfittingBlock[] {
  const daysBack = rewindDaysOf(baseDate)
  return OUTFITTING_FACTORIES.flatMap((factory) => {
    const areaOf = new Map(factory.areas.map((area) => [area.code, area]))
    return blocksAtOutfittingFactory(factory.id).flatMap((block, i): OutfittingBlock[] => {
      const area = areaOf.get(block.outfitting!.areaCode)
      /* 로스터가 가리키는 구역이 fixture 에 없으면 그 블록은 세우지 않는다 —
       * 없는 자리에 그리느니 빠지는 편이 낫다(공장 뷰와 어긋나지 않게). */
      if (!area) return []
      const seed = `${block.projNo}-${block.blockNo}`
      const h = hashOf(seed)
      /*
       * **갓 반입된 블록은 진척이 0 이다** (W7-7-1, 연계 매트릭스 Top2).
       * 신원·단계는 로스터가 정본이고, 이 mock 이 만드는 것은 그 위에 얹는
       * 진척·시각뿐이다 — 어제 들어온 블록에 38%가 쌓여 있을 수는 없다.
       * 되감기(daysBack)와의 결합: 갓 반입은 어느 기준일에서도 0 에서 시작한다.
       */
      const justArrived = block.justArrived === true
      /* 진척: 12%는 대기(0~12), 18%는 완료(100), 나머지는 진행중(20~95) */
      const bucket = h % 100
      const today = bucket < 12 ? h % 13 : bucket >= 82 ? 100 : 20 + (hashOf(`${seed}-p`) % 76)
      const progress = justArrived ? 0 : progressAt(seed, today, daysBack)
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
          justArrived,
          lastScanAt: scanTimeOf(seed),
        },
      ]
    })
  })
}

/*
 * 날짜별로 한 번만 짓고 재사용한다 — 같은 기준일을 여러 화면이 물어도 값이 흔들리지
 * 않아야 하고(같은 배열 참조면 렌더도 덜 돈다), 되감기는 날짜 수만큼만 있으면 된다.
 */
const blocksByDate = new Map<string, OutfittingBlock[]>()

/**
 * **기준일의** 의장 블록 목록.
 *
 * 예전에는 모듈 상수 하나(=늘 오늘)였다. 그래서 통합실적에서 사흘 전을 조회한 채
 * 의장 화면으로 건너가면 의장만 오늘 진척을 말했다(연계 매트릭스 §2.3).
 */
export function outfittingBlocksAt(baseDate: string = todayString()): OutfittingBlock[] {
  const cached = blocksByDate.get(baseDate)
  if (cached) return cached
  const built = buildBlocks(baseDate)
  blocksByDate.set(baseDate, built)
  return built
}

/**
 * 오늘의 블록 — 날짜를 다루지 않는 호출부(구조 검증 테스트 등)를 위한 얇은 별칭.
 * 화면·API 는 `outfittingBlocksAt(baseDate)` 를 쓴다.
 */
export const mockBlocks: OutfittingBlock[] = outfittingBlocksAt()

/*
 * ⚠️ **센서 목록은 여기 없다.** 예전에는 구역마다 `{구역코드}-L1` 을 지어냈지만(27대),
 * 같은 라이다를 설비 상태 화면·베이 3D 뷰·지도 마커는 이관된 `LD-0101` 로 부른다 —
 * 한 설비가 화면마다 다른 이름을 갖는 일이 거기서 시작됐다(`.work/연계매트릭스.md` Top4).
 * 이제 의장 센서의 원천은 `shared/entities/equipment` 하나이고, 이 파일은 블록만 만든다.
 */
