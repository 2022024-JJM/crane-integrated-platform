import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import {
  collectCollidableMeshes,
  meshWorldBox,
  type SavedModelZone,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';

/**
 * 인스펙터 "영역" 탭의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙
 * (AGENTS.md) 대로 여기서 생성·정규화하고 컴포넌트는 그리기만 한다.
 */

/** 모델이 아직 로드되지 않아 크기를 잴 수 없을 때의 새 영역 반경(씬 unit). */
export const DEFAULT_ZONE_RADIUS = 10;

const _box = new Box3();
const _meshBox = new Box3();
const _origin = new Vector3();
const _meshes: Mesh[] = [];

/**
 * 새 영역의 기본 반경 — 영역 중심(모델 루트 원점 XZ)에서 모델 발자국(보이는
 * 메쉬 월드 AABB 합집합)의 가장 먼 XZ 모서리까지의 거리, 0.1 단위 반올림.
 * 즉 모델을 딱 감싸는 원이다. 가로 폭 전체를 반경으로 잡으면 링 지름이 모델의
 * 두 배가 되어 너무 컸다(2026-09-12). 원점이 발자국 한쪽에 치우친 모델은 그만큼
 * 커진다 — 사용자가 오프셋으로 중심을 옮기면 줄일 수 있다. 메쉬는 충돌 감지와
 * 같은 기준(collectCollidableMeshes — Line2·숨김 LOD 제외)으로 모은다.
 * 모델이 아직 마운트되지 않았거나 박스가 비면 null.
 */
export function measureModelFootprintRadius(
  root: Object3D | null,
): number | null {
  if (!root) return null;
  _box.makeEmpty();
  for (const mesh of collectCollidableMeshes(root, _meshes)) {
    _box.union(meshWorldBox(mesh, _meshBox));
  }
  _meshes.length = 0;
  if (_box.isEmpty()) return null;
  root.getWorldPosition(_origin);
  const dx = Math.max(
    Math.abs(_box.min.x - _origin.x),
    Math.abs(_box.max.x - _origin.x),
  );
  const dz = Math.max(
    Math.abs(_box.min.z - _origin.z),
    Math.abs(_box.max.z - _origin.z),
  );
  const radius = Math.hypot(dx, dz);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return Math.max(0.1, Math.round(radius * 10) / 10);
}

/**
 * 새 영역에 순서대로 주는 색 — 서로 잘 구분되는 6색(sky·amber·emerald·
 * fuchsia·orange·violet). 첫 색은 sanitize 의 DEFAULT_ZONE_COLOR 와 같다.
 * 색은 식별자일 뿐 위험도를 뜻하지 않는다.
 */
export const ZONE_COLOR_PRESETS: readonly string[] = [
  '#38bdf8',
  '#fbbf24',
  '#34d399',
  '#e879f9',
  '#fb923c',
  '#a78bfa',
];

/** 기존 영역이 아직 안 쓴 첫 프리셋 색. 전부 썼으면 개수 기준으로 순환. */
export function nextZoneColor(existing: readonly SavedModelZone[]): string {
  const used = new Set(existing.map((z) => z.color.toLowerCase()));
  const free = ZONE_COLOR_PRESETS.find((c) => !used.has(c));
  if (free) return free;
  return ZONE_COLOR_PRESETS[existing.length % ZONE_COLOR_PRESETS.length];
}

/**
 * 새 영역 — 고유 id, 반경(모델 크기 또는 기본값), 미사용 색, 이름. 이름은
 * 호출자(UI)가 번역한 "영역 n" 을 넘긴다 — 저장본에 그대로 남아 충돌 탭·배지
 * 어디서도 id 가 보이지 않는다. 비우면 빈 이름(배지는 "영역 n" 폴백).
 */
export function createModelZone(
  existing: readonly SavedModelZone[],
  radius: number | null = null,
  name = '',
): SavedModelZone {
  return {
    id: `zone-${createId().slice(0, 8)}`,
    name,
    color: nextZoneColor(existing),
    radius:
      radius !== null && Number.isFinite(radius) && radius > 0
        ? radius
        : DEFAULT_ZONE_RADIUS,
  };
}

/** 오프셋 입력 정규화 — 둘 다 0(또는 무효)이면 undefined 로 필드를 뗀다. */
export function normalizeZoneOffset(
  dx: number | undefined,
  dz: number | undefined,
): [number, number] | undefined {
  const x = Number.isFinite(dx) ? (dx as number) : 0;
  const z = Number.isFinite(dz) ? (dz as number) : 0;
  return x === 0 && z === 0 ? undefined : [x, z];
}

/** 영역 하나에 오프셋 한 축을 적용한 새 객체. */
export function withZoneOffsetAxis(
  zone: SavedModelZone,
  axis: 'x' | 'z',
  value: number | undefined,
): SavedModelZone {
  const [dx, dz] = zone.offset ?? [0, 0];
  const offset = normalizeZoneOffset(
    axis === 'x' ? value : dx,
    axis === 'z' ? value : dz,
  );
  const next: SavedModelZone = { ...zone };
  delete next.offset;
  return offset ? { ...next, offset } : next;
}

/**
 * 씬 unit ↔ 표시 m. 저장값은 unit 그대로 두고 인스펙터 입력만 환산한다
 * (옥포 11.7 m/unit — domain scene-unit-scale). 반올림은 표시 쪽 0.01 m,
 * 저장 쪽은 환산 그대로(사용자가 친 m 값이 unit 으로 정확히 들어가게).
 */
export function unitsToDisplayMeters(
  units: number,
  metersPerUnit: number,
): number {
  const scale =
    Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  return Math.round(units * scale * 100) / 100;
}

export function displayMetersToUnits(
  meters: number,
  metersPerUnit: number,
): number {
  const scale =
    Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  return meters / scale;
}
