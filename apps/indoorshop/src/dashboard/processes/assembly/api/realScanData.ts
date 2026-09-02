import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import type { LidarBlockInfo } from '../../../shared/features/bay-viewer/model/lidarBlock'
import {
  loadRealScanManifest,
  type RealScanManifest,
} from './realScanAssets'
import {
  applyAffine,
  displayToBayLocal,
  fitAffineWgsToMeters,
  fitRigid2D,
  obbFrame,
  type Pt2,
} from '../../../shared/features/bay-viewer/lib/realScanAnchor'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'

/**
 * PBS 5BAY 실측 — 한화에너지 PoC 실측 데이터셋 (20251220 스냅샷, 호선 5510).
 *
 * 실측 스캔이 찍힌 자리는 **조립 1공장(PBS)의 5BAY** 다. 한때 이 데이터셋이 GBS 공장
 * 하나를 통째 차지했지만(GBS 에는 5베이가 존재하지도 않는다 — 1~3뿐), 실제 위치 확인에
 * 따라 **베이 단위 부착**으로 바꿨다: PBS 의 다른 베이(1~4·6~8)는 목업으로 동작하고
 * 5BAY 하나만 LiDAR 12대 실측 스캔이다. 실측 홀(87×23.5m)은 PBS 5BAY(237.6×45.1m)의
 * 한 구간에 해당한다.
 *
 * 실측 라이다 그룹 G1~G3(북측/중앙/남측 갠트리)은 별도 정반이 아니라 **5BAY 내부 구획**
 * 으로 해석한다 — 잠정이며, 운영 정반 마스터 확정 시 재검토한다.
 *
 * 좌표 프레임: 실측 자산은 자체 display 프레임(y=0 이 홀 바닥)이다 — 야드 좌표·목업
 * 배치 프레임과 억지로 정합하지 않는다(뷰어 내부용). 점군·CAD 배치·센서 위치는
 * `scripts/build-real-scan-assets.py` 가 생성한 `public/real-scan/` 자산에서 읽는다.
 */

export const REAL_FACTORY_ID = 'asm-pbs'
export const REAL_BAY_NO = 5
/** mock locationId 규약(`{factoryId}-b{bayNo}`)과 같은 형식 — 목록 병합이 id 로 맞물린다 */
export const REAL_LOCATION_ID = `${REAL_FACTORY_ID}-b${REAL_BAY_NO}`
/** 카드·배지가 쓰는 짧은 표기 — '5BAY 실측' */
export const REAL_BAY_LABEL = `${REAL_BAY_NO}BAY`

const REAL_BAY_SPEC = ASSEMBLY_FACTORIES.find((factory) => factory.id === REAL_FACTORY_ID)
  ?.bays.find((bay) => bay.bayNo === REAL_BAY_NO)

/**
 * 실측 베이(PBS 5BAY) 하나. 상태는 여기서 단정하지 않는다 — 재실 여부는 스캔에서
 * 인식된 블록 수로만 알 수 있고, 그건 manifest 를 읽어야 나온다(`fetchRealLocations`).
 * workCntr·yardLots 는 PBS fixture 의 5BAY 것을 그대로 물려받아, 전체 현황 지도의
 * 지번 강조가 실측 베이에서도 이어진다.
 */
export const REAL_LOCATION: Location = {
  id: REAL_LOCATION_ID,
  factoryId: REAL_FACTORY_ID,
  name: `${REAL_BAY_NO}번 베이`,
  status: 'unknown',
  workCntr: REAL_BAY_SPEC?.code ?? 'PB5B',
  yardLots: REAL_BAY_SPEC?.yardLots,
}

/**
 * 5BAY 내부 구획(G1~G3) 라벨 항목 — 정반(Location) 목록에는 들어가지 않고, 실측 뷰어가
 * 홀 안의 갠트리 담당구간을 도색·라벨할 때만 쓴다. id 끝 `-g1` 이 manifest 그룹 키로
 * 풀리는 규약(`realGroupKeyOf`)이다.
 */
export const REAL_SEGMENTS: Location[] = [
  { id: 'real-seg-g1', factoryId: REAL_FACTORY_ID, name: 'G1 구획', status: 'unknown', workCntr: 'G1' },
  { id: 'real-seg-g2', factoryId: REAL_FACTORY_ID, name: 'G2 구획', status: 'unknown', workCntr: 'G2' },
  { id: 'real-seg-g3', factoryId: REAL_FACTORY_ID, name: 'G3 구획', status: 'unknown', workCntr: 'G3' },
]

/** 실측 위치 목록 — 재실/공석을 manifest 의 인식 블록 수에서 낸다 */
export async function fetchRealLocations(): Promise<Location[]> {
  try {
    const manifest = await loadRealScanManifest()
    return [
      {
        ...REAL_LOCATION,
        status: manifest.factory.blocks.length > 0 ? ('occupied' as const) : ('empty' as const),
      },
    ]
  } catch {
    // 점군 자산이 없는 환경(스크립트 미실행)에서도 목록 자체는 떠야 한다
    return [REAL_LOCATION]
  }
}

/** 이 정반이 실측 스캔인가 — 뷰어 선택·색상 규칙·카드 표기가 이 판정 하나를 본다 */
export function isRealLocation(locationId: string | undefined): boolean {
  return locationId === REAL_LOCATION_ID
}

/** 스캔 시각 'YYYY-MM-DD HH:MM' → 화면용 'HH:MM' */
function scanTime(manifest: RealScanManifest): string {
  return manifest.scannedAt.includes('T')
    ? manifest.scannedAt
    : manifest.scannedAt.replace(' ', 'T')
}

/** 5BAY 실측 센서 12대 — 홀 전체(manifest.factory)의 센서를 구획 구분 없이 낸다 */
export async function fetchRealLidarSensors(locationId: string): Promise<LidarSensor[]> {
  const manifest = await loadRealScanManifest()
  return manifest.factory.sensors.map((sensor) => ({
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

/** 5BAY 실측 인식 블록 — 홀 전체(manifest.factory)의 정합 블록을 낸다 */
export async function fetchRealDetectedBlocks(locationId: string): Promise<LidarBlockInfo[]> {
  const manifest = await loadRealScanManifest()
  return manifest.factory.blocks.map((block): LidarBlockInfo => {
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

/* ── 공장 전체 뷰 오버레이 — 실측 점군을 데이터 유도 앵커로 5BAY 자리에 ── */

/**
 * 정합 잔차 허용 한계(m). 도면 이식 자체의 RMS 가 0.67~2.24m 이므로 그 수준이면 같은
 * 배치라는 뜻이고, 크게 벗어나면 도면과 실측 배치가 다른 것 — **적용하지 않는다**(폴백:
 * W0-2 의 '실측 칩만 있는 빈 정반'이 그대로 남는다). 임계는 보수적으로 3m.
 */
const ANCHOR_RMS_LIMIT_M = 3.0
/** 프리뷰 자산 — scripts/build-real-scan-preview.mjs 생성물 (factory.bin 다운샘플) */
const PREVIEW_CLOUD = '/real-scan/factory_preview.bin'
const PREVIEW_SHADE = '/real-scan/factory_preview_shade.bin'

/* 오버레이 데이터 모양은 뷰어 계약(shared bay-viewer)이 소유한다 — 여기서는 재수출만 */
export type { RealScanOverlay } from '../../../shared/features/bay-viewer/model/realOverlay'

async function fetchPreviewBin(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`실측 프리뷰 로드 실패: ${path} (HTTP ${res.status})`)
  return res.arrayBuffer()
}

let overlayPromise: Promise<import('../../../shared/features/bay-viewer/model/realOverlay').RealScanOverlay | null> | null = null

/**
 * 공장 전체 뷰용 실측 오버레이 — 실측 display 프레임을 야드 좌표로 잇는 변환을
 * **센서 12대 점집합 정합으로 유도**해(임의 앵커 없음, S 분석) 프리뷰 점군을 베이
 * 로컬로 옮긴다. 잔차가 한계를 넘거나 자료가 모자라면 null — 호출 쪽은 W0-2 상태
 * (빈 정반 + 실측 칩)로 남는다.
 *
 * 베이 축 방향 오프셋은 **도심 재중심으로 접는다**: 목업 상자(70m)는 실제 베이
 * (237.6m)를 대변하지 못해 "베이 안 어느 구간인가"를 보존할 자리가 없다. 앵커가
 * 이 화면에 실제로 싣는 것은 ① 배치 동일성 검증(RMS) ② 베이 축 대비 **방향**이고,
 * 구간 보존은 실형상 전환(S-(a)) 때 이 변환을 그대로 재사용해 얻는다.
 */
export async function fetchRealScanOverlay(): Promise<import('../../../shared/features/bay-viewer/model/realOverlay').RealScanOverlay | null> {
  overlayPromise ??= (async () => {
    const [manifest, equipmentModule, baysModule] = await Promise.all([
      loadRealScanManifest(),
      import('../../../shared/entities/equipment'),
      import('../../../shared/entities/yard-parcels/parcelBaysFixture'),
    ])

    /* 같은 물리 센서 12대의 두 좌표 — display(수평면 x,z) vs EPSG:5187(x,y) */
    const displaySensors: Pt2[] = manifest.factory.sensors.map((s) => ({
      x: s.position[0],
      y: s.position[2],
    }))
    const lidars = equipmentModule.YARD_EQUIPMENT.filter(
      (e) => e.typeId === 'LIDAR' && e.factory === 'PBS' && e.bay === String(REAL_BAY_NO)
    )
    if (lidars.length !== displaySensors.length || lidars.length < 3) return null

    const rigid = fitRigid2D(displaySensors, lidars.map((e) => ({ x: e.x, y: e.y })))
    if (!rigid) return null

    /* 베이 프레임 — fixture 의 5BAY 껍질(WGS84)을, 설비의 이중 좌표(WGS84+미터)로
     * 맞춘 국소 아핀으로 미터에 올린 뒤 OBB 도심·긴 축을 뽑는다 */
    const affine = fitAffineWgsToMeters(
      lidars.map((e) => ({ lat: e.lat, lon: e.lon, x: e.x, y: e.y }))
    )
    const bayRow = baysModule.RAW_PARCEL_BAYS.find(
      (row) => row[1] === 'PBS' && row[2] === String(REAL_BAY_NO)
    )
    if (!affine || !bayRow) return null
    const hullFlat = bayRow[5]
    const hullMeters: Pt2[] = []
    for (let i = 0; i + 1 < hullFlat.length; i += 2) {
      hullMeters.push(applyAffine(affine, hullFlat[i], hullFlat[i + 1]))
    }
    const frame = obbFrame(hullMeters)
    if (!frame) return null

    /* 잔차 자기검증 — 한계 초과면 적용하지 않는다. 판정 근거는 개발 로그로 남긴다 */
    // eslint-disable-next-line no-console
    console.info(
      `[실측 앵커] 센서 ${lidars.length}쌍 정합 RMS ${rigid.rms.toFixed(2)}m · 회전 ${((rigid.theta * 180) / Math.PI).toFixed(1)}° · 반사 ${rigid.reflected} — ${rigid.rms <= ANCHOR_RMS_LIMIT_M ? '적용' : `한계 ${ANCHOR_RMS_LIMIT_M}m 초과, 폴백`}`
    )
    if (rigid.rms > ANCHOR_RMS_LIMIT_M) return null

    const [cloudBuf, shadeBuf] = await Promise.all([
      fetchPreviewBin(PREVIEW_CLOUD),
      fetchPreviewBin(PREVIEW_SHADE).catch(() => null),
    ])
    const src = new Float32Array(cloudBuf)
    const count = Math.floor(src.length / 3)
    const positions = new Float32Array(count * 3)
    const anchor = { rigid, frame }
    let sumX = 0
    let sumZ = 0
    for (let i = 0; i < count; i++) {
      const local = displayToBayLocal(anchor, src[i * 3], src[i * 3 + 2])
      positions[i * 3] = local.x
      positions[i * 3 + 1] = src[i * 3 + 1] // 높이(y)는 양쪽 다 바닥 0 기준 — 그대로
      positions[i * 3 + 2] = local.y
      sumX += local.x
      sumZ += local.y
    }
    /* 도심 재중심 (위 주석) — 수평 성분만 접고 높이는 두지 않는다 */
    const cx = sumX / count
    const cz = sumZ / count
    for (let i = 0; i < count; i++) {
      positions[i * 3] -= cx
      positions[i * 3 + 2] -= cz
    }
    const shade = shadeBuf && shadeBuf.byteLength === count ? new Uint8Array(shadeBuf) : null
    return { positions, shade, rms: rigid.rms }
  })().catch(() => {
    overlayPromise = null // 일시 실패(자산 미생성 등)는 다음 시도에서 다시
    return null
  })
  return overlayPromise
}
