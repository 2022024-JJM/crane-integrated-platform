import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { loadBlockModel } from '../../../shared/features/bay-viewer/api/loadBlockModel'
import {
  buildBayDetections,
  type BayModelInfo,
} from '../../../shared/features/bay-viewer/lib/mockDetections'
import type { BaySceneData } from '../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { outfittingFactoryByName } from '../lib/bayBlocks'
import type { OutfittingBlock } from '../model/block'
import { hashOf } from './mockOutfittingData'
import { devicesOfBay } from '../lib/equipmentStatus'

/*
 * 의장 베이 3D 장면 (mock) — **뷰어 문법은 조립, 데이터는 의장**.
 *
 * 뷰어 UX(점군·카메라·센서 마커·도구줄·범례)는 조립 베이 뷰어(shared bay-viewer)를 그대로
 * 쓴다. 하지만 그 안에 서는 **인식 대상은 의장 문법**이어야 한다:
 *
 *  · **의장은 블록 하나가 작업 단위이고 그 아래 계층이 없다.** 소조/중조/대조·ASSY 구분이
 *    존재하지 않으므로 `unitLevel` 을 고르지 않는다 — 언제나 블록 단위 인식 1건이고,
 *    `assySerNo`(조립 일련번호)는 늘 null, 하위 구성(소조) 목록도 만들지 않는다.
 *  · **블록의 신원은 로스터가 정한다.** 데모 CAD 모델은 형상일 뿐이라 그 안의 호선·블록번호는
 *    그 모델의 것이다. 이 베이에 실제로 어느 블록이 있는지는 의장 로스터가 이미 알고 있고
 *    (`blocksOfBay`), 그 번호로 세워야 통합실적·목록·지도가 같은 블록을 같은 이름으로 부른다.
 *  · 진척률도 로스터 블록의 값을 그대로 쓴다 — 뷰어의 `진척` 색상 모드가 목록의 진척과
 *    다른 숫자를 말하면 어느 쪽이 맞는지 묻게 된다.
 *
 * 전부 결정론(해시 시드)이라 같은 베이는 항상 같은 장면이다.
 */

/**
 * 데모 CAD 형상 풀 — public/models/ 의 FBX 전처리 산출물.
 *
 * **형상으로만 쓴다.** 여기 적힌 호선·블록번호는 그 모델 파일의 것이고, 화면에 서는 번호는
 * 로스터가 준다. `unitLevel` 같은 조립 계층 구분은 두지 않는다(의장에는 없는 개념이다).
 */
const DEMO_SHAPES: { projNo: string; blkNo: string }[] = [
  { projNo: '2540', blkNo: '281' },
  { projNo: '2543', blkNo: '642' },
  { projNo: '2570', blkNo: '153' },
  { projNo: '4391', blkNo: '154' },
  { projNo: '4392', blkNo: '133' },
]

/** 의장 베이 장면 한 벌 — 뷰어 입력(BaySceneData)과 그 작업 위치(베이) */
export interface OutfittingBayScene {
  location: Location
  scene: BaySceneData
  /** 이 장면이 세운 로스터 블록 — 없으면 이 베이에 배정된 블록이 없다는 뜻이다 */
  block: OutfittingBlock | null
}

/**
 * 이 베이의 LiDAR — **실제 이관된 설비**를 쓴다.
 *
 * 예전에는 `센서 1·2·3…` 을 지어냈다. 그런데 같은 화면의 설비 상태 패널은 이미 도면에서
 * 이관된 실제 라이다(`LD-0101` …)를 이름으로 부르고 있다 — 뷰어만 다른 이름을 쓰면 같은
 * 베이의 센서가 두 이름을 갖게 된다. 상태도 같은 출처(`equipmentLinkOf`)를 따른다.
 *
 * **이관 라이다가 아직 없는 베이**(POS 3·5BAY)는 빈 목록으로 두지 않는다 — 뷰어의 점군은
 * 전부 센서 명의의 합성 스캔이라, 센서가 0대면 바닥 점군조차 서지 못한다(W7-7-4).
 * 그렇다고 새 센서를 지어내지도 않는다: **공장 뷰가 이미 쓰는 구역 센서 mock**
 * (`mockSensors` — 목업 자리 문법과 같은 출처)을 그 베이의 구역으로 걸러 그대로 세운다.
 * 도면 이관이 그 베이에 닿으면 실제 라이다가 이 폴백을 저절로 밀어낸다.
 */
async function bayLidarSensors(
  factoryName: string,
  bayNo: string,
  locationId: string
): Promise<LidarSensor[]> {
  const transferred = devicesOfBay(factoryName, bayNo)
    .filter((device) => device.kind === 'LIDAR')
    .map(
      (device): LidarSensor => ({
        id: device.id,
        /* 뷰어는 이 장면의 작업 위치 id 로 센서를 묶는다 — 목록의 복합키가 아니라 그것을 준다 */
        locationId,
        name: device.id,
        status: device.status,
        lastScanAt: device.lastScanAt ?? '',
        lastHeartbeatAt: device.lastHeartbeatAt,
      })
    )
  if (transferred.length > 0) return transferred

  /* 폴백 — 가짜 센서 우주(mockSensors)는 W7-7-3 에서 폐기됐다(sensorNameContract).
   * 다만 점군 합성은 스캔 원점이 최소 1개 필요하므로, 이관 라이다가 없는 베이에는
   * **장비를 사칭하지 않는 가상 스캔 원점**을 하나 세운다 — id 가 SCAN- 접두라 설비ID
   * 체계(LD-*)와 섞이지 않고, 이름도 원점임을 그대로 말한다. 도면이 그 베이에 닿으면
   * 이관 라이다가 이 자리를 대체한다. */
  return [
    {
      id: `SCAN-${locationId}`,
      locationId,
      name: '가상 스캔 원점 (도면 미배치 베이)',
      status: 'online',
      lastScanAt: '',
      lastHeartbeatAt: '',
    },
  ]
}

/**
 * 공장명 + 베이(지번 fixture 의 `{공장}#{베이}` id 와 베이 번호·라벨)로 mock 장면을 만든다.
 *
 * 작업 위치 id 는 실형상 빌더와 같은 `{공장id}-b{베이번호}` 규약을 쓴다 — 실좌표·실측이
 * 붙을 때 조립과 같은 이음새로 갈아 끼우기 위해서다. **의장은 베이에서 끝난다** —
 * 그 아래 정반·지번으로 더 파고드는 단계가 없다.
 */
export async function fetchOutfittingBayScene(
  factoryName: string,
  bayNo: string,
  bayLabel: string,
  /** 이 베이의 로스터 블록 — 호출부(맵 진입)가 이미 계산해 둔 것을 그대로 받는다 */
  bayBlocks: readonly OutfittingBlock[] = []
): Promise<OutfittingBayScene | null> {
  const spec = outfittingFactoryByName(factoryName)
  if (!spec) return null

  const locationId = `${spec.id}-b${bayNo}`
  const demo = DEMO_SHAPES[hashOf(`${locationId}-model`) % DEMO_SHAPES.length]
  const model = await loadBlockModel(demo.projNo, demo.blkNo)

  /*
   * 이 베이에 세울 블록 — 로스터가 준 것 중 **진척이 가장 높은 것**(결정론).
   *
   * 베이에 여러 블록이 배정돼 있어도 형상은 한 벌뿐이라 한 건만 세운다. 점군은 진척률만큼의
   * 부재에서만 합성되므로(조립과 같은 규칙), 대기(진척 0) 블록을 뽑으면 점군이 거의 서지
   * 않는다 — 해시 뽑기 대신 진척 최댓값(동률이면 id 순)을 세워 조립 베이와 같은 급의 점군
   * 밀도를 보장한다(W7-7-4). 배정된 블록이 없으면 인식 대상 없이 베이만 선다 —
   * 없는 블록을 지어내지 않는다.
   */
  const ordered = [...bayBlocks].sort(
    (a, b) => b.progress - a.progress || a.id.localeCompare(b.id)
  )
  const block = ordered.length > 0 ? ordered[0] : null

  /* 배치 — 베이 중앙 근처, 미세 오프셋·yaw 만 결정론으로 흔든다(조립 배정값과 같은 급) */
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

  /*
   * 인식 목록 — **언제나 블록 단위 1건**이다. 조립처럼 중조립품으로 쪼개지 않고,
   * 하위 구성(소조)도 붙이지 않는다. 신원·진척은 로스터 블록의 것을 그대로 쓴다.
   */
  const blocks = block
    ? buildBayDetections(locationId, bayModel, 'block', {
        blockName: (blkNo) => `블록 ${blkNo}`,
        identity: { projNo: block.projNo, blkNo: block.blkNo, wstgCode: block.wstgCode },
        subAssemblies: false,
        progress: block.progress,
      })
    : []

  return {
    location,
    block,
    scene: {
      location,
      sensors: await bayLidarSensors(factoryName, bayNo, locationId),
      blocks,
      bayModel,
    },
  }
}
