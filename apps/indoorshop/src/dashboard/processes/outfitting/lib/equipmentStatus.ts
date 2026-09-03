import { YARD_EQUIPMENT, equipmentTypeOf } from '../../../shared/entities/equipment'
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

/** 설비 엔티티에 이 공장 행이 있으면 그것을 쓴다 (대수도 베이도 실데이터) */
function entityDevicesOf(factory: string): OutfittingDevice[] {
  return YARD_EQUIPMENT.filter((e) => e.factory === factory && KIND_SET.has(e.typeId)).map((e) =>
    deviceOf(e.id, e.typeId as OutfittingDeviceKind, e.factory, e.bay || '-', false)
  )
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
