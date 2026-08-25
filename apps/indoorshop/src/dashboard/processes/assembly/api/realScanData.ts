import type { Factory } from '../../../shared/entities/factory/model/types'
import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../model/lidarSensor'
import type { LidarBlockInfo } from '../model/lidarBlock'
import {
  loadRealScanManifest,
  realGroupKeyOf,
  type RealScanManifest,
} from './realScanAssets'

/**
 * 조립 5공장 (실측데이터) — 한화에너지 PoC 실측 데이터셋(20251220_150000).
 *
 * 다른 공장은 목업이지만 이 공장은 LiDAR 12대 실측 스캔이다. 다만 정반(베이) 마스터가
 * 없어서, 베이 계층은 라이다 **그룹**(G1 북측 / G2 중앙 / G3 남측 갠트리)으로 대신한다.
 * 점군·CAD 배치·센서 위치는 `scripts/build-real-scan-assets.py` 가 생성한
 * `public/real-scan/` 자산에서 읽는다 (bin 파일은 용량 문제로 git 미포함 — 스크립트로 재생성).
 */

export const REAL_FACTORY: Factory = {
  id: 'factory-real5',
  name: '조립 5공장',
  displayName: '조립 5공장 (실측데이터)',
  assyShop: 'A35',
  locationCount: 3,
  health: 'healthy',
}

/**
 * 실측 베이 목록. 상태는 여기서 단정하지 않는다 — 정반 마스터가 없어 재실 여부는
 * 스캔에서 인식된 블록 수로만 알 수 있고, 그건 manifest 를 읽어야 나온다
 * (`fetchRealLocations`). manifest 를 못 읽으면 이 기본값(미상)이 그대로 남는다.
 */
export const REAL_LOCATIONS: Location[] = [
  { id: 'real5-g1', factoryId: REAL_FACTORY.id, name: 'G1 베이', status: 'unknown', workCntr: 'G1' },
  { id: 'real5-g2', factoryId: REAL_FACTORY.id, name: 'G2 베이', status: 'unknown', workCntr: 'G2' },
  { id: 'real5-g3', factoryId: REAL_FACTORY.id, name: 'G3 베이', status: 'unknown', workCntr: 'G3' },
]

/**
 * 실측 베이 목록 — 재실/공석을 manifest 의 인식 블록 수에서 낸다.
 *
 * 세 베이를 전부 '재실'로 박아두면, 조립품이 하나도 인식되지 않은 베이(스캔 시점의
 * G1)까지 작업 중으로 보여 공장 전체 뷰와 베이 뷰가 서로 다른 말을 한다.
 */
export async function fetchRealLocations(): Promise<Location[]> {
  try {
    const manifest = await loadRealScanManifest()
    return REAL_LOCATIONS.map((location) => ({
      ...location,
      status: manifest.groups[realGroupKeyOf(location.id)].blocks.length > 0
        ? ('occupied' as const)
        : ('empty' as const),
    }))
  } catch {
    // 점군 자산이 없는 환경(스크립트 미실행)에서도 목록 자체는 떠야 한다
    return REAL_LOCATIONS
  }
}

const REAL_LOCATION_IDS = new Set(REAL_LOCATIONS.map((location) => location.id))

export function isRealFactory(factoryId: string | undefined): boolean {
  return factoryId === REAL_FACTORY.id
}

export function isRealLocation(locationId: string | undefined): boolean {
  return locationId != null && REAL_LOCATION_IDS.has(locationId)
}

/** 스캔 시각 'YYYY-MM-DD HH:MM' → 화면용 'HH:MM' */
function scanTime(manifest: RealScanManifest): string {
  return manifest.scannedAt.split(' ')[1] ?? manifest.scannedAt
}

export async function fetchRealLidarSensors(locationId: string): Promise<LidarSensor[]> {
  const manifest = await loadRealScanManifest()
  const group = manifest.groups[realGroupKeyOf(locationId)]
  return group.sensors.map((sensor) => ({
    id: `${locationId}-${sensor.name}`,
    locationId,
    name: sensor.name,
    status: 'online',
    lastScanAt: scanTime(manifest),
  }))
}

/** '5510_726_FR84A' → 호선 5510 / 블록 726 / 조립번호 FR84A */
function parseBlockName(name: string): { projNo: string; blkNo: string; assySerNo: string | null } {
  const [projNo, blkNo, ...rest] = name.split('_')
  return { projNo, blkNo, assySerNo: rest.length > 0 ? rest.join('_') : null }
}

/** 정합 오차(cm) → 신뢰도 — 실측치가 없으면 표시용 하한 */
function confidenceFromFitError(fitErrorCm: number | undefined): number {
  if (fitErrorCm == null) return 0.8
  return Math.max(0.55, Math.min(0.99, 1 - fitErrorCm / 100))
}

export async function fetchRealDetectedBlocks(locationId: string): Promise<LidarBlockInfo[]> {
  const manifest = await loadRealScanManifest()
  const group = manifest.groups[realGroupKeyOf(locationId)]
  return group.blocks.map((block): LidarBlockInfo => {
    const { projNo, blkNo, assySerNo } = parseBlockName(block.name)
    return {
      id: `${locationId}-${block.name}`,
      locationId,
      projNo,
      blkNo,
      assySerNo,
      blockName: `실측 정합 블록 ${block.name}`,
      // 실측 데이터셋에는 송선기호가 없다 — 미상 표기
      wstgCode: '----',
      cadRegistered: true,
      plan: null,
      confidence: confidenceFromFitError(block.fitErrorCm),
      dimensions: {
        length: block.dims[0],
        width: block.dims[1],
        height: block.dims[2],
      },
      transform: { position: block.center, quaternion: [0, 0, 0, 1] },
      history: [{ timestamp: scanTime(manifest), event: '스캔 취득 (LiDAR 12대 정합)' }],
    }
  })
}
