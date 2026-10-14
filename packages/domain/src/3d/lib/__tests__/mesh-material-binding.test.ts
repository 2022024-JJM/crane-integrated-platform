import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import {
  acquireSeaVariant,
  releaseSeaVariant,
  seaVariantCacheSize,
} from '../sea-material-cache';
import {
  assignSharedSeaMaterials,
  createMeshMaterialBinding,
  ensureClonedMaterials,
  restoreOriginalMaterials,
} from '../mesh-material-binding';

const SEA_CACHE_KEY = 'sea-submersion';

function makeBinding(material = new MeshStandardMaterial()) {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
  return { binding: createMeshMaterialBinding(mesh), mesh, material };
}

function cacheKeyOf(material: unknown): string {
  return (material as { customProgramCacheKey: () => string })
    .customProgramCacheKey();
}

describe('sea-material-cache', () => {
  it('같은 원본 2회 acquire 는 같은 variant 참조를 준다(refcount)', () => {
    const original = new MeshStandardMaterial();
    const a = acquireSeaVariant(original);
    const b = acquireSeaVariant(original);
    expect(a).toBe(b);
    expect(a).not.toBe(original);
    expect(cacheKeyOf(a)).toBe(SEA_CACHE_KEY);
    releaseSeaVariant(original);
    releaseSeaVariant(original);
  });

  it('refs 0 에서 dispose 되고, 재acquire 는 새 variant 를 만든다', () => {
    const original = new MeshStandardMaterial();
    const first = acquireSeaVariant(original);
    const before = seaVariantCacheSize();
    releaseSeaVariant(original);
    expect(seaVariantCacheSize()).toBe(before - 1);
    const second = acquireSeaVariant(original);
    expect(second).not.toBe(first);
    releaseSeaVariant(original);
  });

  it('release 초과 호출은 no-op 이다', () => {
    const original = new MeshStandardMaterial();
    expect(() => releaseSeaVariant(original)).not.toThrow();
    acquireSeaVariant(original);
    releaseSeaVariant(original);
    expect(() => releaseSeaVariant(original)).not.toThrow();
  });
});

describe('mesh-material-binding 상태 전이', () => {
  it('잠김 공유: 같은 원본의 두 바인딩이 variant 를 공유하고, 복원 시 원본으로 돌아간다', () => {
    const shared = new MeshStandardMaterial();
    const a = makeBinding(shared);
    const b = makeBinding(shared);
    assignSharedSeaMaterials(a.binding);
    assignSharedSeaMaterials(b.binding);
    expect(a.mesh.material).toBe(b.mesh.material);
    expect(a.mesh.material).not.toBe(shared);
    expect(cacheKeyOf(a.mesh.material)).toBe(SEA_CACHE_KEY);

    restoreOriginalMaterials(a.binding);
    expect(a.mesh.material).toBe(shared);
    // b 는 여전히 공유 variant 를 쓴다(release 대칭 확인).
    expect(cacheKeyOf(b.mesh.material)).toBe(SEA_CACHE_KEY);
    restoreOriginalMaterials(b.binding);
    expect(seaVariantCacheSize()).toBe(0);
  });

  it('공유 상태 재할당은 멱등이다(refcount 이중 증가 없음)', () => {
    const { binding, mesh } = makeBinding();
    assignSharedSeaMaterials(binding);
    const variant = mesh.material;
    assignSharedSeaMaterials(binding);
    expect(mesh.material).toBe(variant);
    restoreOriginalMaterials(binding);
    expect(seaVariantCacheSize()).toBe(0);
  });

  it('공유 → 개별 승격: 원본에서 clone 되고 잠김 패치가 다시 걸린다', () => {
    const { binding, mesh, material } = makeBinding();
    assignSharedSeaMaterials(binding);
    const sharedVariant = mesh.material;

    const [promoted] = ensureClonedMaterials(binding, true);
    expect(promoted).not.toBe(sharedVariant);
    expect(promoted).not.toBe(material);
    expect(mesh.material).toBe(promoted);
    // 승격이 공유 참조를 반납했으므로 캐시가 비어야 한다(마지막 사용자였음).
    expect(seaVariantCacheSize()).toBe(0);
    // 잠김 패치 재적용 — 이게 빠지면 승격된 메시만 안개가 사라진다.
    expect(cacheKeyOf(promoted)).toBe(SEA_CACHE_KEY);
    // 알람 tint 복원용 원본 색 보관.
    expect(
      (promoted as unknown as { _originalColor?: unknown })._originalColor,
    ).toBeDefined();
    restoreOriginalMaterials(binding);
  });

  it('개별 → 잠김 공유 복귀: 개별 클론이 처분되고 공유 variant 로 전환된다', () => {
    const { binding, mesh } = makeBinding();
    const [promoted] = ensureClonedMaterials(binding, true);
    assignSharedSeaMaterials(binding);
    expect(mesh.material).not.toBe(promoted);
    expect(binding.cloned).toBeNull();
    expect(cacheKeyOf(mesh.material)).toBe(SEA_CACHE_KEY);
    restoreOriginalMaterials(binding);
  });

  it('바다 없는 승격은 잠김 패치를 걸지 않는다', () => {
    const { binding } = makeBinding();
    const [promoted] = ensureClonedMaterials(binding, false);
    expect(cacheKeyOf(promoted)).not.toBe(SEA_CACHE_KEY);
    restoreOriginalMaterials(binding);
  });

  it('머티리얼 배열도 공유·복원이 대칭이다', () => {
    const m1 = new MeshStandardMaterial();
    const m2 = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), [m1, m2]);
    const binding = createMeshMaterialBinding(mesh);
    assignSharedSeaMaterials(binding);
    const materials = mesh.material as MeshStandardMaterial[];
    expect(materials).toHaveLength(2);
    expect(cacheKeyOf(materials[0])).toBe(SEA_CACHE_KEY);
    restoreOriginalMaterials(binding);
    expect(mesh.material).toEqual([m1, m2]);
    expect(seaVariantCacheSize()).toBe(0);
  });
});
