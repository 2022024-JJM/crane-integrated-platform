import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import type { LidarBlockInfo } from '../../../shared/features/bay-viewer/model/lidarBlock'
import {
  loadRealScanManifest,
  type RealScanManifest,
} from './realScanAssets'
import {
  applyAffine,
  fitAffineWgsToMeters,
  fitWallAxis,
  obbFrame,
  wallToBayLocal,
  type Pt2,
  type WallAnchor,
  type WallFrame,
} from '../../../shared/features/bay-viewer/lib/realScanAnchor'
import type {
  RealScanOverlay,
  RealScanSensorPlacement,
} from '../../../shared/features/bay-viewer/model/realOverlay'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'

/**
 * PBS 5BAY 실측 — 한화에너지 PoC 실측 데이터셋 (20251220 스냅샷, 호선 5510).
 *
 * 실측 스캔이 찍힌 자리는 **조립 1공장(PBS)의 5BAY** 다. 한때 이 데이터셋이 GBS 공장
 * 하나를 통째 차지했지만(GBS 에는 5베이가 존재하지도 않는다 — 1~3뿐), 실제 위치 확인에
 * 따라 **베이 단위 부착**으로 바꿨다: PBS 의 다른 베이(1~4·6~8)는 목업으로 동작하고
 * 5BAY 하나만 LiDAR 12대 실측 스캔이다. 점군에서 잰 실측 홀은 **내부 103.1 × 41.97m**
 * 로, PBS 5BAY(237.7×45.1m)의 **한 구간**이다 — 베이 전체가 아니라는 점이 아래 앵커
 * 규칙(종방향 1 자유도)의 전제다.
 *
 * 실측 라이다 그룹 G1~G3(북측/중앙/남측 갠트리)은 별도 정반이 아니라 **5BAY 내부 구획**
 * 으로 해석한다 — 잠정이며, 운영 정반 마스터 확정 시 재검토한다.
 *
 * 좌표 프레임: 실측 자산은 자체 display 프레임(y=0 이 홀 바닥)이다. 베이 뷰(RealScanViewer)
 * 는 그 프레임을 그대로 쓰고, 공장 전체 뷰만 베이 로컬로 옮긴다 — 그 변환을 점군의
 * 장변 벽선에서 유도하는 것이 이 파일 아래쪽의 앵커다. 점군·CAD 배치·센서 위치는
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
 * **내부폭 대조 게이트** — 점군에서 유도한 벽면간 폭 ÷ 도면 5BAY 단변.
 *
 * 장변 벽은 지번 껍질 안쪽에 있으므로 비는 1 이하가 정상이다(현 데이터 41.97/45.09 =
 * 0.931, 편측 여유 1.56m). 크게 작으면 장변 벽이 아니라 홀 내부 구조(갠트리 레일 등)를
 * 잡은 것이므로 **적용하지 않는다** — 폴백은 종전과 같다(빈 정반 + 실측 칩).
 *
 * 이전 게이트(12센서 강체정합 RMS ≤ 3m)는 폐기했다. 실측 12대(갠트리 3기에 뭉친
 * 64.7×4.6m)와 설비 도면 12대(베이 전장 238m 에 32m 피치, 213.8×39.0m)는 **서로 다른
 * 장비 집합**이라 어떤 강체변환으로도 맞지 않고(RMS 52.75m), 임계를 완화하면 틀린 앵커만
 * 통과한다. 근거는 W5-3 분석 §A③.
 */
const ANCHOR_WIDTH_RATIO_MIN = 0.8
const ANCHOR_WIDTH_RATIO_MAX = 1.05
/** 두 장변 벽선 각의 허용 편차(도) — 평행하지 않으면 벽이 아니다. 현 데이터 0.095° */
const ANCHOR_WALL_SPREAD_LIMIT_DEG = 1.0

/**
 * **종방향 앵커** — 실측 홀의 북측 끝벽면을 베이 북쪽 끝(에서 편측 여유만큼 안쪽)에 맞춘다.
 *
 * 왜 규칙이 필요한가: 실측 홀은 내부 103m 라 5BAY 전장(238m)의 한 구간이다. 벽선은
 * 회전과 횡방향까지만 결정하고, 남는 1 자유도(베이 안 어느 구간인가)는 점군만으로
 * 닫히지 않는다. 북단 정렬을 택한 근거(W5-3 분석 §A(3)):
 *  · 횡방향에서 관측된 **같은 편측 여유**(지번경계↔벽면)가 종방향까지 설명한다 —
 *    다른 배치에서는 이 값이 임의가 된다
 *  · 그 결과 홀이 지번 PB5B03(정반 구획, 베이 로컬 z 3.4~118.8m) 안에 앉는다
 *  · 베이 북쪽 끝 바깥에는 지번이 없고(=베이가 거기서 끝난다), 남쪽 끝 바깥은
 *    옥외 적치장(PB1S02)이다
 *  · 어느 쪽이 북인지는 **가정하지 않는다** — 갠트리 그룹 방위(G1=북측 / G3=남측,
 *    데이터셋 README)로 점군에서 정한다
 * 현 데이터에서 종방향 오프셋 du = +51.6m.
 *
 * **확정(2026-09-03, 사용자 위임·코디네이터 결정): 북단 정렬 채택.** 근거는 데이터
 * 자기정합이다 — 횡방향 여유 2.61m 를 대칭으로 적용하면 홀이 지번 PB5B03 안에 정착하고,
 * 그 위치가 W5-3 리포트 추정과 0.34m 차이에 든다. 별도 실측 없이 데이터가 스스로
 * 닫히는 유일한 배치라 이 값을 채택한다.
 *
 * 추후 정반 조회 데이터(2025-12-20 15:00 시점 호선 5510 블록 553_FR103C~106C · 726_* ·
 * 736_* 의 PB5B01/02/03 소재)가 오면 아래를 `{ kind: 'measured', offsetM: <실측 du> }` 로
 * **값만 바꿔** 교체할 수 있다 — 코드 경로는 이미 두 갈래를 다 받는다.
 */
const LONGITUDINAL_ANCHOR: { kind: 'north-end' } | { kind: 'measured'; offsetM: number } = {
  kind: 'north-end',
}

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

/**
 * 도면 5BAY 의 외곽 치수(m) — fixture 껍질(WGS84)을 설비의 이중 좌표(WGS84+EPSG:5187)로
 * 맞춘 국소 아핀으로 미터에 올린 뒤 OBB 를 뽑는다. 새 투영 코드를 들이지 않는 이유는
 * `fitAffineWgsToMeters` 주석 참조. 앵커가 쓰는 것은 **길이·폭 두 값**뿐이다.
 */
export async function loadRealBayDimensions(): Promise<{ long: number; short: number } | null> {
  const [equipmentModule, baysModule] = await Promise.all([
    import('../../../shared/entities/equipment'),
    import('../../../shared/entities/yard-parcels/parcelBaysFixture'),
  ])
  const lidars = equipmentModule.YARD_EQUIPMENT.filter(
    (e) => e.typeId === 'LIDAR' && e.factory === 'PBS' && e.bay === String(REAL_BAY_NO)
  )
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
  return frame && { long: frame.long, short: frame.short }
}

/**
 * 벽선 프레임 + 도면 베이 치수 + 갠트리 방위 → 베이 로컬 앵커.
 *
 * 순수 함수로 떼어 둔 이유: 게이트 판정과 종방향 규칙이 로더 안에 있으면 검증할 수 없다.
 * 게이트를 통과하지 못하면 `null` 이고, 호출 쪽은 오버레이를 만들지 않는다.
 */
export function buildRealScanAnchor(
  wall: WallFrame,
  bay: { long: number; short: number },
  /** 갠트리 그룹별 센서 위치(display) — 앞뒤(180°) 판정용. G1=북측, G3=남측 */
  gantry: { north: readonly [number, number, number][]; south: readonly [number, number, number][] }
): { anchor: WallAnchor; widthRatio: number } | null {
  const widthRatio = wall.innerWidth / bay.short
  if (widthRatio < ANCHOR_WIDTH_RATIO_MIN || widthRatio > ANCHOR_WIDTH_RATIO_MAX) return null
  if ((wall.angleSpread * 180) / Math.PI > ANCHOR_WALL_SPREAD_LIMIT_DEG) return null

  /* 앞뒤 — 벽선 각은 (-π/2, π/2] 로 접혀 있어 방향을 정하지 않는다.
   * 갠트리 북측(G1) 그룹이 남측(G3)보다 장축 좌표가 크면 그 방향이 베이 +길이(북)다. */
  const c = Math.cos(wall.angle)
  const s = Math.sin(wall.angle)
  const meanAlong = (list: readonly [number, number, number][]): number | null =>
    list.length > 0 ? list.reduce((sum, p) => sum + p[0] * c + p[2] * s, 0) / list.length : null
  const north = meanAlong(gantry.north)
  const south = meanAlong(gantry.south)
  if (north == null || south == null || north === south) return null
  const sign = north > south ? 1 : -1

  /* 북쪽 끝벽 — sign<0 이면 접힌 프레임의 '작은 쪽' 끝벽이 북단이고, 좌표도 뒤집힌다 */
  const endWall = sign > 0 ? wall.endWalls[1] : wall.endWalls[0]
  if (endWall == null) return null

  const sideMargin = (bay.short - wall.innerWidth) / 2
  const longitudinalOffset =
    LONGITUDINAL_ANCHOR.kind === 'measured'
      ? LONGITUDINAL_ANCHOR.offsetM
      : bay.long / 2 - sideMargin - sign * endWall

  return {
    anchor: {
      angle: sign > 0 ? wall.angle : wall.angle + Math.PI,
      lateralOrigin: sign * wall.center,
      longitudinalOffset,
    },
    widthRatio,
  }
}

let overlayPromise: Promise<RealScanOverlay | null> | null = null

/**
 * 공장 전체 뷰용 실측 오버레이 — display 프레임을 베이 로컬로 잇는 변환을 **점군의
 * 장변 벽선에서 유도**해(임의 앵커 없음) 프리뷰 점군과 실측 센서 12대를 함께 옮긴다.
 * 게이트를 통과하지 못하거나 자료가 모자라면 null — 호출 쪽은 종전 상태(빈 정반 +
 * 실측 칩)로 남는다.
 *
 * 베이 축 방향 위치를 **더는 도심으로 접지 않는다**: 실형상 배치(yard-fixture)의 베이
 * 상자는 실제 5BAY 치수(238×45m)라 "베이 안 어느 구간인가"를 담을 자리가 있다.
 * 그 구간은 `LONGITUDINAL_ANCHOR` 규칙이 정한다 — 북단 정렬로 확정됐고(2026-09-03),
 * 채택 근거와 measured 교체 경로는 그 주석에 있다.
 */
export async function fetchRealScanOverlay(): Promise<RealScanOverlay | null> {
  overlayPromise ??= (async () => {
    const [manifest, bay, cloudBuf, shadeBuf] = await Promise.all([
      loadRealScanManifest(),
      loadRealBayDimensions(),
      fetchPreviewBin(PREVIEW_CLOUD),
      fetchPreviewBin(PREVIEW_SHADE).catch(() => null),
    ])
    if (!bay) return null

    const src = new Float32Array(cloudBuf)
    const wall = fitWallAxis(src)
    if (!wall) return null

    const sensorsOf = (group: 'g1' | 'g3') =>
      manifest.factory.sensors.filter((s) => s.group === group).map((s) => s.position)
    const built = buildRealScanAnchor(wall, bay, {
      north: sensorsOf('g1'), // 데이터셋 README: G1 = 갠트리 북측
      south: sensorsOf('g3'), //                 G3 = 갠트리 남측
    })

    /* 판정 근거는 개발 로그로 남긴다 — 화면만 보고는 게이트 결과를 알 수 없다 */
    // eslint-disable-next-line no-console
    console.info(
      `[실측 앵커] 벽선 내부폭 ${wall.innerWidth.toFixed(2)}m / 도면 단변 ${bay.short.toFixed(2)}m` +
        ` = ${(wall.innerWidth / bay.short).toFixed(3)} · 벽 평행도 ${((wall.angleSpread * 180) / Math.PI).toFixed(3)}°` +
        ` · 장축 ${((wall.angle * 180) / Math.PI).toFixed(3)}° — ` +
        (built
          ? `적용 (회전 ${((built.anchor.angle * 180) / Math.PI).toFixed(2)}° · 종방향 ${built.anchor.longitudinalOffset.toFixed(2)}m)`
          : `게이트(폭 비 ${ANCHOR_WIDTH_RATIO_MIN}~${ANCHOR_WIDTH_RATIO_MAX}) 미통과, 폴백`)
    )
    if (!built) return null
    const { anchor, widthRatio } = built

    const count = Math.floor(src.length / 3)
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const local = wallToBayLocal(anchor, src[i * 3], src[i * 3 + 2])
      positions[i * 3] = local.x
      positions[i * 3 + 1] = src[i * 3 + 1] // 높이(y)는 양쪽 다 바닥 0 기준 — 그대로
      positions[i * 3 + 2] = local.y
    }
    /* 센서 12대 — 점군과 **같은 변환**을 태운다. 마커가 점군과 어긋날 여지가 없다. */
    const sensors: RealScanSensorPlacement[] = manifest.factory.sensors.map((sensor) => {
      const local = wallToBayLocal(anchor, sensor.position[0], sensor.position[2])
      return { name: sensor.name, position: [local.x, sensor.position[1], local.y] }
    })
    const shade = shadeBuf && shadeBuf.byteLength === count ? new Uint8Array(shadeBuf) : null
    return { positions, shade, sensors, innerWidth: wall.innerWidth, widthRatio }
  })().catch(() => {
    overlayPromise = null // 일시 실패(자산 미생성 등)는 다음 시도에서 다시
    return null
  })
  return overlayPromise
}
