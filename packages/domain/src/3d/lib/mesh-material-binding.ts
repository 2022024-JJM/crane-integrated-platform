import { Color, type Material, type Mesh } from 'three';
import { applySeaSubmersion } from './sea-submersion';
import { acquireSeaVariant, releaseSeaVariant } from './sea-material-cache';

/**
 * GLTF 인스턴스의 메시 ↔ 머티리얼 상태 전이 — ModelMesh 의 effect 들이 쓴다.
 * 상태는 셋이고 전이가 이 파일의 본론이다(순수 로직이라 테스트 대상).
 *
 *   원본 공유(fast)      : mesh.material = GLTF 원본 그대로. 비용 0.
 *   잠김 공유(shared)    : seaSubmersion 만 필요한 인스턴스 — 원본당 1개의
 *                          패치 클론을 refcount 공유(sea-material-cache.ts).
 *                          **공유본에 프로퍼티를 쓰면 같은 GLB 전 인스턴스가
 *                          물든다** — 쓰기가 필요해지는 순간 개별로 승격한다.
 *   개별 클론(individual): opacity<1·알람 tint·meshOverride opacity 등 인스턴스
 *                          전용 뮤테이션이 필요할 때. seaSubmersion 씬이면
 *                          승격 시 잠김 패치를 다시 건다 — 승격이 공유본이
 *                          아니라 원본에서 clone 하기 때문이다.
 */
export interface MeshMaterialBinding {
  mesh: Mesh;
  /** 마운트 시점의 원본 material reference. fast-path 복원/판별에 사용. */
  original: Material | Material[];
  /** 이 instance용으로 lazy clone된 material(개별 승격 후). */
  cloned: Material | Material[] | null;
  /** 잠김 공유 variant 사용 중 여부 — release 대칭을 위해 기억한다. */
  shared: boolean;
}

export function createMeshMaterialBinding(mesh: Mesh): MeshMaterialBinding {
  return { mesh, original: mesh.material, cloned: null, shared: false };
}

function toArray(value: Material | Material[]): Material[] {
  return Array.isArray(value) ? value : [value];
}

/** 잠김 공유 variant 반납 — shared 상태가 아니면 no-op. */
function releaseShared(binding: MeshMaterialBinding): void {
  if (!binding.shared) return;
  binding.shared = false;
  for (const original of toArray(binding.original)) {
    releaseSeaVariant(original);
  }
}

/**
 * 개별 클론 처분 — dispose 후 cloned 를 비운다. mesh.material 재지정은
 * 호출자가 다음 상태로 한다.
 */
function disposeCloned(binding: MeshMaterialBinding): void {
  if (!binding.cloned) return;
  for (const c of toArray(binding.cloned)) {
    c.dispose();
  }
  binding.cloned = null;
}

/**
 * 잠김 공유 상태로 전이. 이미 공유 중이면 no-op(멱등). 개별 클론이 있었으면
 * 처분한다 — 알람이 꺼져 "잠김만" 으로 돌아오는 경로.
 */
export function assignSharedSeaMaterials(binding: MeshMaterialBinding): void {
  if (binding.shared) return;
  disposeCloned(binding);
  const originals = toArray(binding.original);
  const variants = originals.map((original) => acquireSeaVariant(original));
  binding.shared = true;
  binding.mesh.material = Array.isArray(binding.original)
    ? variants
    : variants[0];
}

/**
 * 개별 클론으로 승격(또는 기존 클론 재사용) — 인스턴스 전용 뮤테이션 직전에
 * 부른다. 잠김 공유 중이었으면 반납하고 **원본에서** 새로 clone 한 뒤,
 * `seaSubmersion` 이면 패치를 다시 건다(공유본에서 clone 하면 반납·dispose
 * 시점 관리가 꼬인다). 원본 color 는 알람 tint 복원용으로 보관한다.
 */
export function ensureClonedMaterials(
  binding: MeshMaterialBinding,
  seaSubmersion: boolean,
): Material[] {
  if (binding.cloned) {
    return toArray(binding.cloned);
  }
  releaseShared(binding);

  const clone = (material: Material): Material => {
    const c = material.clone();
    if ('color' in c && c.color instanceof Color) {
      (c as unknown as { _originalColor: Color })._originalColor =
        c.color.clone();
    }
    if (seaSubmersion) {
      applySeaSubmersion(c);
    }
    return c;
  };

  if (Array.isArray(binding.original)) {
    const cloned = binding.original.map(clone);
    binding.cloned = cloned;
    binding.mesh.material = cloned;
    return cloned;
  }
  const cloned = clone(binding.original);
  binding.cloned = cloned;
  binding.mesh.material = cloned;
  return [cloned];
}

/**
 * 원본 공유(fast) 복원 — 개별 클론은 dispose, 잠김 공유는 release 하고
 * mesh.material 을 GLTF 원본 reference 로 되돌린다. 언마운트 정리도 이것.
 */
export function restoreOriginalMaterials(binding: MeshMaterialBinding): void {
  if (!binding.cloned && !binding.shared) return;
  disposeCloned(binding);
  releaseShared(binding);
  binding.mesh.material = binding.original;
}
