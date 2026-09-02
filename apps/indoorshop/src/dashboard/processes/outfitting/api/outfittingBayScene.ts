import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { loadBlockModel } from '../../../shared/features/bay-viewer/api/loadBlockModel'
import {
  buildBayDetections,
  type BayModelInfo,
} from '../../../shared/features/bay-viewer/lib/mockDetections'
import type { BaySceneData } from '../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { outfittingFactoryByName } from '../lib/bayBlocks'
import { hashOf } from './mockOutfittingData'

/*
 * 의장 베이 3D 장면 (mock) — 조립 1/2공장 mock 문법을 그대로 준용한다.
 *
 * 베이(지번 fixture 의 스팬)에 데모 CAD 블록 모델 하나를 결정론으로 배정하고, shared
 * bay-viewer 의 `buildBayDetections`(조립 mock 의 단일 소스)로 인식 목록을 만든다 —
 * 뷰어가 그 위에 합성 LiDAR 바닥 스캔·센서 마커를 세우는 것까지 조립 베이 뷰와 같은
 * 파이프라인이다. 의장 고유 의미론(의장품 설치 상태)은 실측·설계 자료 수령 후 얹는다 —
 * 지금은 '조립과 같은 베이 뷰'가 우선이다(2026-09-02 사용자 지시).
 *
 * 전부 결정론(해시 시드)이라 같은 베이는 항상 같은 장면이다.
 */

/** 데모 CAD 블록 풀 — public/models/ 의 FBX 전처리 산출물(조립 데모와 같은 자산) */
const DEMO_MODELS: { projNo: string; blkNo: string; unitLevel: 'assembly' | 'block' }[] = [
  { projNo: '2540', blkNo: '281', unitLevel: 'assembly' },
  { projNo: '2543', blkNo: '642', unitLevel: 'assembly' },
  { projNo: '2570', blkNo: '153', unitLevel: 'assembly' },
  { projNo: '4391', blkNo: '154', unitLevel: 'block' },
  { projNo: '4392', blkNo: '133', unitLevel: 'block' },
]

/** 의장 베이 장면의 좌표 한 벌 — 뷰어 입력(BaySceneData)과 그 정반(location) */
export interface OutfittingBayScene {
  location: Location
  scene: BaySceneData
  unitLevel: 'assembly' | 'block'
}

/** 베이 지번 수 규모의 결정론 센서 목록 — 조립 mock(베이당 6~8대, 소수 고장) 문법 준용 */
function mockBaySensors(locationId: string): LidarSensor[] {
  const count = 6 + (hashOf(`${locationId}-sensor-n`) % 3)
  return Array.from({ length: count }, (_, i): LidarSensor => {
    const id = `${locationId}-s${i + 1}`
    const roll = hashOf(`${id}-roll`) % 100
    const status = roll < 8 ? 'offline' : roll < 13 ? 'error' : 'online'
    const h = 13 + (hashOf(`${id}-h`) % 3)
    const m = hashOf(`${id}-m`) % 60
    return {
      id,
      locationId,
      name: `센서 ${i + 1}`,
      status,
      lastScanAt: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    }
  })
}

/**
 * 공장명 + 베이(지번 fixture 의 `{공장}#{베이}` id 와 베이 번호·라벨)로 mock 장면을 만든다.
 *
 * 정반 id 는 실형상 빌더와 같은 `{공장id}-b{베이번호}` 규약을 쓴다 — 실좌표·실측이
 * 붙을 때 조립과 같은 이음새로 갈아 끼우기 위해서다.
 */
export async function fetchOutfittingBayScene(
  factoryName: string,
  bayNo: string,
  bayLabel: string
): Promise<OutfittingBayScene | null> {
  const spec = outfittingFactoryByName(factoryName)
  if (!spec) return null

  const locationId = `${spec.id}-b${bayNo}`
  const demo = DEMO_MODELS[hashOf(`${locationId}-model`) % DEMO_MODELS.length]
  const model = await loadBlockModel(demo.projNo, demo.blkNo)

  /* 배치 — 정반 중앙 근처, 미세 오프셋·yaw 만 결정론으로 흔든다(조립 배정값과 같은 급) */
  const ox = ((hashOf(`${locationId}-px`) % 5) - 2) * 0.5
  const oz = ((hashOf(`${locationId}-pz`) % 7) - 3) * 0.7
  const yaw = ((hashOf(`${locationId}-yaw`) % 9) - 4) * 0.02
  const bayModel: BayModelInfo = {
    model,
    placement: {
      position: [ox, 0, oz],
      quaternion: [0, +Math.sin(yaw / 2).toFixed(4), 0, +Math.cos(yaw / 2).toFixed(4)],
    },
  }

  const location: Location = {
    id: locationId,
    factoryId: spec.id,
    name: bayLabel,
    status: 'occupied',
    workCntr: `${spec.shopCode}-${bayNo}`,
  }

  const blocks = buildBayDetections(locationId, bayModel, demo.unitLevel, {
    /* 조립 문구(대조립/중조립품) 대신 중립 명칭 — 의장 고유 의미론은 실자료 수령 후 */
    blockName: (blkNo) => `블록 ${blkNo}`,
    assemblyName: (id) => `조립체 ${id}`,
  })

  return {
    location,
    unitLevel: demo.unitLevel,
    scene: {
      location,
      sensors: mockBaySensors(locationId),
      blocks,
      bayModel,
    },
  }
}
