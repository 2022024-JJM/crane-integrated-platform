import {
  YARD_EQUIPMENT,
  equipmentLinkOf,
  equipmentTypeOf,
  tiltStatusIn,
  type EquipmentStatusSnapshot,
  type TiltMode,
  type TiltModuleStatus,
} from '../../../shared/entities/equipment'
import type { MapEntryMarker } from '../../../shared/features/process-map-entry'
import type { LidarSensor, LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { OUTFITTING_FACTORIES } from '../api/outfittingFactoryFixture'
import { mockSensors } from '../api/mockOutfittingData'
import {
  OUTFITTING_DEVICE_KINDS,
  type OutfittingDevice,
  type OutfittingDeviceKind,
  type OutfittingDeviceSummary,
} from '../model/equipment'

/*
 * 의장 설비 상태의 순수 계산 — 어느 설비가 어느 공장·베이에 서고, 그 상태를 무엇으로
 * 보는가. 화면(React)에서 떼어 둔 것은 조립 `lib/mapEntry` 와 같은 이유다: 규칙이 UI
 * 안에 있으면 검증할 수 없다.
 *
 * **대수·좌표의 단일 소스는 설비 엔티티(`shared/entities/equipment`)** 이고, 여기서는
 * 그 행을 읽기만 한다 — 엔티티 스키마를 이 화면 사정으로 바꾸지 않는다. 도면 이관이
 * 아직 의장 공장에 닿지 않아 엔티티에 그 공장의 행이 하나도 없으면, 없는 자리를
 * 비워 두는 대신 **구역 골격 위에 목업 자리**를 세우고 `placeholder` 로 표시한다 —
 * 이관이 끝나면 같은 화면이 실데이터로 채워지고 이 폴백은 저절로 빠진다.
 *
 * 상태·heartbeat 는 실측 파이프라인이 없어 조립과 **같은 결정론 해시** 목업이다
 * (렌더마다 흔들리지 않는다).
 */

/** 문자열 기반 결정적 의사난수 — 조립 `lib/mapEntry`·의장 mock 과 같은 방식 */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 의장 공장 이름들 — 설비 엔티티의 `factory` 와 같은 체계(지번 fixture 공장명) */
export function outfittingFactoryNames(): string[] {
  return OUTFITTING_FACTORIES.map((factory) => factory.name)
}

/**
 * 설비 한 대의 mock 상태 — 실좌표(설비 엔티티)는 실데이터이고 **상태만** 목업이다.
 * 분포는 조립과 같다: 대부분 온라인, 드물게 점검(오프라인)·오류.
 */
export function mockDeviceStatus(id: string): LidarSensorStatus {
  const h = hashOf(`${id}-status`)
  if (h % 29 === 0) return 'error'
  if (h % 13 === 0) return 'offline'
  return 'online'
}

/** heartbeat 시각 — 결정론적 (13:00~15:59, 조립 mock 과 같은 규칙) */
export function mockHeartbeatAt(id: string): string {
  const h = 13 + (hashOf(`${id}-hb-h`) % 3)
  const m = hashOf(`${id}-hb-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 스캔 시각 — heartbeat 보다 조금 이르게 잡는다(스캔은 heartbeat 주기보다 성기다) */
export function mockDeviceScanAt(id: string): string {
  const h = 13 + (hashOf(`${id}-scan-h`) % 3)
  const m = hashOf(`${id}-scan-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 관측 설비만 스캔 시각을 갖는다 — Edge PC·판넬은 찍지 않는다 */
function observes(kind: OutfittingDeviceKind): boolean {
  return kind === 'LIDAR' || kind === 'TILT'
}

function deviceOf(
  id: string,
  kind: OutfittingDeviceKind,
  factory: string,
  bay: string,
  placeholder: boolean
): OutfittingDevice {
  const status = mockDeviceStatus(id)
  return {
    id,
    kind,
    factory,
    bay,
    status,
    lastHeartbeatAt: mockHeartbeatAt(id),
    lastScanAt: observes(kind) ? mockDeviceScanAt(id) : undefined,
    placeholder,
  }
}

const KIND_SET = new Set<string>(OUTFITTING_DEVICE_KINDS)

/**
 * 설비 엔티티에 이 공장 행이 있으면 그것을 쓴다 (대수도 베이도 실데이터).
 *
 * 상태는 **shared 의 `equipmentLinkOf`** 에 묻는다 — 틸팅·Edge PC·판넬은 종류마다 상태
 * 계약이 따로 있고(모드·자원·전원), 그 계약의 '링크' 축을 여기서 다시 해시로 지어내면
 * 같은 ED-011 이 조립 화면과 의장 화면에서 다른 답을 하게 된다. 라이다도 같은 함수가
 * 기존 규칙 그대로 답한다(공장 뷰 센서 mock 과 어긋나지 않는다).
 */
function entityDevicesOf(factory: string): OutfittingDevice[] {
  return YARD_EQUIPMENT.filter((e) => e.factory === factory && KIND_SET.has(e.typeId)).map((e) => ({
    ...deviceOf(e.id, e.typeId as OutfittingDeviceKind, e.factory, e.bay || '-', false),
    status: equipmentLinkOf(e),
  }))
}

/**
 * 목업 자리 — 구역(area) 골격 위에 도면과 같은 **모양**만 세운다.
 *
 * 라이다는 지어내지 않고 **공장 뷰가 이미 쓰는 센서 mock**(`mockOutfittingData`)을 그대로
 * 읽는다 — 한 공장이 공장 뷰에서는 10/14, 설비 상태에서는 13/14 라고 말하면 어느 쪽을
 * 믿어야 하는지 알 수 없다. 그 위에 도면상 라이다와 쌍으로 서는 틸팅모듈을 짝지어
 * 세우고, 공장마다 Edge PC·네트워크 판넬을 한 대씩 둔다.
 *
 * 대수를 실제로 아는 척하지 않으려고 베이 자리에는 도면 베이 번호가 아니라 **구역
 * 코드**를 넣는다.
 */
function placeholderDevicesOf(factory: string): OutfittingDevice[] {
  const spec = OUTFITTING_FACTORIES.find((f) => f.name === factory)
  if (!spec) return []
  const codeOfArea = new Map(spec.areas.map((area) => [area.name, area.code]))
  const devices: OutfittingDevice[] = []
  for (const sensor of mockSensors) {
    if (sensor.factoryId !== spec.id) continue
    const bay = codeOfArea.get(sensor.areaName) ?? sensor.areaName
    devices.push({
      id: sensor.name,
      kind: 'LIDAR',
      factory,
      bay,
      status: sensor.status,
      lastHeartbeatAt: mockHeartbeatAt(sensor.id),
      lastScanAt: sensor.lastScanAt,
      placeholder: true,
    })
    // 틸팅은 라이다의 짝 — 신원을 이어 붙여(`…-L1` → `…-T1`) 같은 자리에 세운다
    devices.push(deviceOf(sensor.name.replace(/-L(\d+)$/, '-T$1'), 'TILT', factory, bay, true))
  }
  devices.push(deviceOf(`EDGE-${spec.shopCode}`, 'EDGE', factory, '-', true))
  devices.push(deviceOf(`PNL-${spec.shopCode}`, 'PNL', factory, '-', true))
  return devices
}

/**
 * 공장 한 곳의 설비 — 엔티티 우선, 없으면 목업 자리.
 *
 * 섞지 않는다: 엔티티에 한 대라도 있으면 그 공장은 실데이터 공장으로 보고 목업을
 * 얹지 않는다(반쯤 진짜인 목록이 제일 읽기 어렵다).
 */
export function outfittingDevices(factory: string): OutfittingDevice[] {
  const fromEntity = entityDevicesOf(factory)
  return fromEntity.length > 0 ? fromEntity : placeholderDevicesOf(factory)
}

/** 베이(또는 구역)별로 묶는다 — 드릴다운 목록의 골격. 번호 순 정렬 */
export function devicesByBay(devices: readonly OutfittingDevice[]): Map<string, OutfittingDevice[]> {
  const map = new Map<string, OutfittingDevice[]>()
  for (const device of devices) {
    const key = device.bay || '-'
    const list = map.get(key)
    if (list) list.push(device)
    else map.set(key, [device])
  }
  for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id))
  return new Map(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  )
}

/** 공장 요약 — 카드 접힌 줄·전체 합계가 같은 계산을 쓴다 */
export function deviceSummaryOf(factory: string): OutfittingDeviceSummary {
  const devices = outfittingDevices(factory)
  const byKind = Object.fromEntries(
    OUTFITTING_DEVICE_KINDS.map((kind) => [kind, { total: 0, online: 0 }])
  ) as OutfittingDeviceSummary['byKind']
  let online = 0
  let lastHeartbeatAt: string | undefined
  for (const device of devices) {
    const slot = byKind[device.kind]
    slot.total += 1
    if (device.status === 'online') {
      slot.online += 1
      online += 1
    }
    // 같은 날 안이면 'HH:MM' 사전순이 곧 시간순
    if (!lastHeartbeatAt || device.lastHeartbeatAt > lastHeartbeatAt) {
      lastHeartbeatAt = device.lastHeartbeatAt
    }
  }
  return {
    factory,
    total: devices.length,
    online,
    issues: devices.length - online,
    byKind,
    placeholder: devices.length > 0 && devices.every((device) => device.placeholder),
    lastHeartbeatAt,
  }
}

/** 설비 → 센서 상태 목록의 계약 — 조립과 같은 목록 문법을 그대로 쓰기 위한 변환 */
export function toSensorRow(device: OutfittingDevice): LidarSensor {
  return {
    id: device.id,
    locationId: `${device.factory}#${device.bay}`,
    name: device.id,
    status: device.status,
    lastScanAt: device.lastScanAt ?? '',
    lastHeartbeatAt: device.lastHeartbeatAt,
  }
}

/** 종류 라벨의 보조 출처 — 엔티티 레지스트리에 이름이 있으면 그것을 쓴다 */
export function deviceKindName(kind: OutfittingDeviceKind): string | null {
  return equipmentTypeOf(kind)?.name ?? null
}

/* ══ 지도 마커 · 틸팅 상세 (W6-4) ════════════════════════════════
 *
 * 도면 이관(W6-1)이 닿기 전에는 의장 맵에 마커를 세우지 않았다 — 실좌표가 없어 없는
 * 자리를 지어낼 수 없었기 때문이다. 이제 290대가 실좌표로 들어왔으므로 도장(DH/GH)·
 * 조립(종류 심볼)과 **같은 문법**으로 지도에 세운다.
 */

/** 지도·목록이 세우는 종류 — `OUTFITTING_DEVICE_KINDS` 와 같은 넷 */
export const OUTFITTING_MARKER_TYPES = OUTFITTING_DEVICE_KINDS

/** 맵 마커로 세울 설비 한 대 — 프레임 마커 계약 + 종류·상태 */
export interface OutfittingEquipmentMarker extends MapEntryMarker {
  typeId: OutfittingDeviceKind
  bay: string
  /** 이 설비가 물린 캐비닛 ID (없으면 빈 문자열) */
  panelId: string
  status: LidarSensorStatus
}

/** 설비ID → 엔티티 (좌표를 붙일 때 쓴다) */
const entityById = new Map(YARD_EQUIPMENT.map((e) => [e.id, e]))

/**
 * 주인공 공장들의 설비 마커.
 *
 * 목록(`outfittingDevices`)과 **같은 배열에서** 만든다 — 지도가 자기 상태를 따로 계산하면
 * 같은 설비가 지도에서는 온라인, 목록에서는 오류가 되는 날이 온다.
 *
 * ⚠️ 목업 자리(placeholder)는 좌표가 없다 — 마커로 세우지 않는다(지도에 없는 자리를
 *    지어내지 않는다). 이관이 끝난 지금은 해당 없음이지만 규칙으로 남긴다.
 * ⚠️ 틸팅은 페어 라이다에서 1.7m 떨어져 서므로 기본 표시에서 빼는 것이 읽기 좋다 —
 *    켜고 끄는 판단은 화면이 한다(이 함수는 달라는 종류만 준다).
 */
export function outfittingEquipmentMarkers(
  factories: readonly string[],
  typeIds: readonly string[]
): OutfittingEquipmentMarker[] {
  const wanted = new Set(typeIds)
  const markers: OutfittingEquipmentMarker[] = []
  for (const factory of factories) {
    for (const device of outfittingDevices(factory)) {
      if (!wanted.has(device.kind)) continue
      const entity = entityById.get(device.id)
      if (!entity || device.placeholder) continue
      markers.push({
        id: device.id,
        typeId: device.kind,
        factory: device.factory,
        bay: device.bay,
        panelId: entity.panelId,
        lat: entity.lat,
        lon: entity.lon,
        status: device.status,
        title: `${device.id} · ${equipmentTypeOf(device.kind)?.name ?? device.kind} · ${device.factory}${device.bay && device.bay !== '-' ? ` ${device.bay}BAY` : ''}`,
        ariaLabel: `${device.id} ${equipmentTypeOf(device.kind)?.name ?? device.kind}`,
      })
    }
  }
  return markers
}

/** 한 베이(공장 내 베이명)의 설비 — 베이 드릴다운 카드가 그 범위만 센다 */
export function devicesOfBay(factory: string, bayNo: string): OutfittingDevice[] {
  return outfittingDevices(factory).filter((device) => device.bay === bayNo)
}

/** 종류별 대수 — 공장 카드·베이 카드의 한 줄 요약 */
export function deviceCountsByKind(
  devices: readonly OutfittingDevice[]
): Record<OutfittingDeviceKind, number> {
  const counts = { LIDAR: 0, TILT: 0, EDGE: 0, PNL: 0 }
  for (const device of devices) counts[device.kind] += 1
  return counts
}

/**
 * 틸팅 한 대의 상세 상태 — 모드·현재/목표 각·페어 라이다·모터 알람.
 *
 * ⚠️ 통신 상태는 **여기서 다시 말하지 않는다** — 목록 줄이 이미 그 축(온라인/오프라인/
 *    오류)을 배지로 내고 있고, 둘이 같은 `equipmentLinkOf` 에서 나온다. 같은 사실을 두 번
 *    적으면 어느 쪽이 맞는지 묻게 된다.
 *
 * 틸팅이 아니거나 엔티티에 없는 설비(목업 자리)면 null — 지어내지 않는다.
 * **아직 스냅샷이 안 온 설비도 null** 이다: 각·모드는 망 너머에서 오는 값이라 지어낼 수
 * 없다(목록 줄의 링크 배지는 파생 규칙이라 그 사이에도 답한다).
 */
export function tiltDetailOf(
  device: OutfittingDevice,
  snapshot: EquipmentStatusSnapshot
): TiltModuleStatus | null {
  if (device.kind !== 'TILT' || device.placeholder) return null
  return entityById.has(device.id) ? tiltStatusIn(snapshot, device.id) : null
}

/**
 * 이 설비를 '이상'으로 볼 것인가 — 목록의 테두리 규칙.
 *
 * 통신이 끊긴 것만 이상이 아니다. 통신은 살아 있는데 **모터 알람으로 틸팅이 에러 모드**면
 * 그 페어 라이다는 엉뚱한 곳을 본다 — 조용히 지나가면 안 되는 상태다. 그래서 모드도 같은
 * 규칙에 태운다.
 */
export function isDeviceFailing(device: OutfittingDevice, tilt: TiltModuleStatus | null): boolean {
  return device.status !== 'online' || tilt?.mode === 'error'
}

/** 공장 하나의 틸팅 모드별 대수 — 요약 줄이 "몇 대가 움직이고 몇 대가 에러인가"를 말한다 */
export function tiltModeCountsOf(
  factory: string,
  snapshot: EquipmentStatusSnapshot
): Record<TiltMode, number> {
  const counts: Record<TiltMode, number> = { idle: 0, tilting: 0, error: 0 }
  for (const device of outfittingDevices(factory)) {
    const tilt = tiltDetailOf(device, snapshot)
    if (tilt) counts[tilt.mode] += 1
  }
  return counts
}

/* ══ 우측 패널의 구성 (W6-5) ═════════════════════════════════════
 *
 * 조립과 **같은 문법**을 쓰기로 했으므로, 그 문법이 실제로 같은지도 코드가 지켜야 한다.
 * 구획 순서·접힘 규칙·수집 줄을 컴포넌트 밖으로 꺼내 두면 두 공정을 나란히 놓고 비교하는
 * 테스트를 쓸 수 있다(화면을 띄워 눈으로 세지 않는다).
 */

/** 설비 상태 단의 구획 하나 — 조립 `EquipmentSection` 과 같은 모양 */
export interface OutfittingEquipmentSection {
  typeId: OutfittingDeviceKind
  count: number
  collapsible: boolean
  groups?: { bay: string; ids: string[] }[]
}

/**
 * 설비 상태 단의 구획 — 관측(라이다 → 틸팅) 먼저, 수집·네트워크(Edge PC → 캐비닛) 나중.
 * 라이다만 베이별로 나뉘고 틸팅만 접힌다 — 조립과 같은 규칙이다.
 */
export function outfittingEquipmentSections(factory: string): OutfittingEquipmentSection[] {
  const devices = outfittingDevices(factory)
  const counts = deviceCountsByKind(devices)
  const sections: OutfittingEquipmentSection[] = []

  const byBay = new Map<string, string[]>()
  for (const device of devices) {
    if (device.kind !== 'LIDAR') continue
    const key = device.bay || '-'
    const list = byBay.get(key)
    if (list) list.push(device.id)
    else byBay.set(key, [device.id])
  }
  if (byBay.size > 0) {
    sections.push({
      typeId: 'LIDAR',
      count: counts.LIDAR,
      collapsible: false,
      groups: [...byBay.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([bay, ids]) => ({ bay, ids })),
    })
  }
  if (counts.TILT > 0) sections.push({ typeId: 'TILT', count: counts.TILT, collapsible: true })
  if (counts.EDGE > 0) sections.push({ typeId: 'EDGE', count: counts.EDGE, collapsible: false })
  if (counts.PNL > 0) sections.push({ typeId: 'PNL', count: counts.PNL, collapsible: false })
  return sections
}

/** 수집 현황 한 줄 — 라벨은 번역 키, 값은 이미 센 결과 (조립과 같은 계약) */
export interface OutfittingCollectionRow {
  labelKey: string
  value: string
}

/**
 * ②수집 현황의 줄.
 *
 * 의장이 세는 것은 정반이 아니라 **블록**이지만 읽는 문법은 조립과 같다 — 몇 개를
 * 감지했고, 무엇이 끝났고, 마지막 수집이 언제인가. '작업중/대기'는 여기서 쓰지 않는다.
 */
export function outfittingCollectionRows(overview: {
  blockTotal: number
  inProgress: number
  completed: number
  lastScanAt?: string
}): OutfittingCollectionRow[] {
  return [
    {
      labelKey: 'outfitting.mapEntry.collection.detected',
      value: `${overview.inProgress + overview.completed}/${overview.blockTotal}`,
    },
    {
      labelKey: 'outfitting.mapEntry.collection.doneToday',
      value: String(overview.completed),
    },
    {
      labelKey: 'outfitting.mapEntry.collection.lastScan',
      value: overview.lastScanAt ?? '—',
    },
  ]
}

/** 수집 현황에서 공장 현황으로 나가는 경로 — 짝이 없으면 null */
export function outfittingFactoryStatusHref(factory: string): string | null {
  const spec = OUTFITTING_FACTORIES.find((f) => f.name === factory)
  return spec ? `/zones/outfitting/${spec.id}` : null
}
