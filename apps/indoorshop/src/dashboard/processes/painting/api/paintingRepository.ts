import { equipmentOfTypes, equipmentTypeOf } from '../../../shared/entities/equipment'
import {
  PAINTING_EQUIPMENT_KINDS,
  type FactoryEquipmentSummary,
  type PaintingEquipment,
  type PaintingEquipmentKind,
} from '../model/equipment'
import type { PaintingEquipmentStatus } from '../model/equipmentStatus'
import { mockEquipmentStatus } from '../lib/equipmentStatusMock'

/**
 * 선행도장 설비 데이터 접근 파사드.
 *
 * 공용 설비 엔티티(`shared/entities/equipment` — painting 원본 503대를
 * `scripts/build-equipment-fixture.mjs` 로 변환한 것)에서 **도장 몫(DH 제습기·GH
 * 가스히터, 86대)만 걸러** 이 모듈의 kind 문자열('제습기'/'가스히터')로 사상한다 —
 * SCADA 화면·mock 은 그 문자열을 키로 쓰므로 손대지 않는다. 86대뿐이라 모듈 로드 때
 * 한 번만 색인해 두면 되고, 목록·맵이 같은 배열을 참조하므로 필터 결과를 참조 비교로
 * 걸러낼 수 있다.
 *
 * 실연동 시 이 파일의 함수 구현만 실제 조회(Hot Data DB / ISL Server Provider)로
 * 교체하면 되고, 호출부(컴포넌트)는 수정이 필요 없다. 상태값(가동/온습도 등)은 아직
 * 데이터가 없어 이 계층이 다루지 않는다 — 배치·집계용 필드만 낸다.
 */

/** 도장 몫의 종류ID → 이 모듈의 kind. 레지스트리 이름과 같아야 하며 어긋나면 즉시 throw */
const PAINTING_TYPE_IDS = ['DH', 'GH'] as const

const equipment: readonly PaintingEquipment[] = equipmentOfTypes(PAINTING_TYPE_IDS).map((e) => {
  const kind = equipmentTypeOf(e.typeId)?.name
  if (kind !== '제습기' && kind !== '가스히터') {
    throw new Error(`도장 설비 종류 매핑 실패: ${e.id} typeId=${e.typeId} name=${kind}`)
  }
  return { id: e.id, kind, factory: e.factory, bay: e.bay, lat: e.lat, lon: e.lon, x: e.x, y: e.y }
})

/** 공장별로 미리 갈라 둔다 — 공장을 고를 때마다 86대를 훑지 않도록 */
const byFactory = new Map<string, PaintingEquipment[]>()
for (const item of equipment) {
  const bucket = byFactory.get(item.factory)
  if (bucket) bucket.push(item)
  else byFactory.set(item.factory, [item])
}

const byId = new Map(equipment.map((e) => [e.id, e]))

/** 도장 설비 전체 */
export function fetchPaintingEquipment(): readonly PaintingEquipment[] {
  return equipment
}

/** 특정 공장의 설비 (없는 공장이면 빈 배열) */
export function fetchEquipmentByFactory(factory: string): readonly PaintingEquipment[] {
  return byFactory.get(factory) ?? []
}

/** ID 로 한 대 */
export function findEquipment(id: string): PaintingEquipment | null {
  return byId.get(id) ?? null
}

/** 설비가 있는 도장공장 이름 — 대수 많은 순 */
export function paintingFactories(): string[] {
  return [...byFactory.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([factory]) => factory)
}

/** 공장별 종류 집계 — 배치 요약·필터 칩에서 쓴다. 대수 많은 순 */
export function equipmentSummaryByFactory(): FactoryEquipmentSummary[] {
  return paintingFactories().map((factory) => {
    const items = byFactory.get(factory) ?? []
    const byKind = Object.fromEntries(
      PAINTING_EQUIPMENT_KINDS.map((kind) => [kind, 0])
    ) as Record<PaintingEquipmentKind, number>
    for (const item of items) byKind[item.kind] += 1
    return { factory, total: items.length, byKind }
  })
}

/** 종류별 전체 대수 — 범례·요약 줄에서 쓴다 */
export function equipmentCountByKind(): Record<PaintingEquipmentKind, number> {
  const counts = Object.fromEntries(
    PAINTING_EQUIPMENT_KINDS.map((kind) => [kind, 0])
  ) as Record<PaintingEquipmentKind, number>
  for (const item of equipment) counts[item.kind] += 1
  return counts
}

/*
 * ── 설비 운전 상태(6종 metric) ──
 *
 * ⚠️ 아직 실 데이터가 없다 — 아래는 **모의(mock) 값**이다(`lib/equipmentStatusMock`).
 * 배치·집계용 fixture 와 달리 상태는 시간에 따라 변하므로, 이 함수를 화면이 주기적으로
 * 다시 부르면(폴링) 실측값·통신 상태·"최근 수신 시각"이 갱신된다. 실연동 시 이 함수 몸통만
 * Hot Data DB / ISL Server Provider 조회로 바꾸면 되고, 훅·화면은 손대지 않는다.
 *
 * Promise 로 내는 것은 그 실연동(네트워크 조회) 형태를 미리 맞춰 두기 위함이다.
 */

/** 설비 여러 대의 현재 상태를 한 번에 (없는 ID 는 건너뛴다). `now` 는 주입받는다 */
export async function fetchEquipmentStatus(
  ids: readonly string[],
  now: number = Date.now()
): Promise<PaintingEquipmentStatus[]> {
  const statuses: PaintingEquipmentStatus[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item) statuses.push(mockEquipmentStatus(item, now))
  }
  return statuses
}

/** 특정 공장 전체 설비의 현재 상태 */
export async function fetchStatusByFactory(
  factory: string,
  now: number = Date.now()
): Promise<PaintingEquipmentStatus[]> {
  const items = byFactory.get(factory) ?? []
  return items.map((item) => mockEquipmentStatus(item, now))
}
