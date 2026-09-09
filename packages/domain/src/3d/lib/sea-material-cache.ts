import type { Material } from 'three';
import { applySeaSubmersion } from './sea-submersion';

/**
 * seaSubmersion 전용 공유 머티리얼 캐시 — 원본 머티리얼당 패치된 클론 1개를
 * refcount 로 공유한다.
 *
 * 왜: 바다 씬에서는 모든 모델 인스턴스가 slow path(머티리얼 clone)를 타는데,
 * 잠김 안개 패치는 월드 Y 만 쓰는 per-object 데이터가 필요 없는 효과라
 * 인스턴스별 클론이 전부 낭비다. 같은 GLB 를 N 개 배치하면 클론이 N×메시
 * 수만큼 생기고(실측: 인스턴스별 uniforms 딥클론 8.9KB + 드로우콜마다
 * refreshMaterial ~3µs), 모델 수십 개 씬에서 프레임당 0.6~1.7ms 가 된다.
 * "기본 상태(opacity 1·알람 없음·잠김만)" 인스턴스들이 원본당 1개의 패치
 * 클론을 공유하면 이 비용이 고유 머티리얼 수준으로 떨어지고, 불투명 렌더
 * 리스트가 material.id 로 정렬되므로 같은 머티리얼이 연속 배치되어
 * refreshMaterial 횟수 자체도 준다.
 *
 * 키는 **원본 Material 참조**다 — drei useGLTF 캐시가 URL 당 원본을 전역
 * 공유하므로 같은 GLB 의 모든 인스턴스·모든 캔버스가 같은 키로 모이고,
 * 한 인스턴스 안의 중복 바인딩(메시 8개/머티리얼 6종)도 자동 dedupe 된다.
 *
 * 공유본에는 **어떤 프로퍼티도 쓰면 안 된다** — 알람 tint·opacity 가 필요한
 * 인스턴스는 개별 클론으로 승격한다(mesh-material-binding.ts). refcount 가
 * 0 이 되면 dispose 한다 — 공유본을 인스턴스가 직접 dispose 하면 남은
 * 인스턴스 전부가 프로그램을 재획득하게 되므로 반드시 release 로 반납한다.
 */

interface CacheEntry {
  variant: Material;
  refs: number;
}

const cache = new Map<Material, CacheEntry>();

/** 원본에 대응하는 공유 잠김 variant 를 얻는다(refcount +1). */
export function acquireSeaVariant(original: Material): Material {
  let entry = cache.get(original);
  if (!entry) {
    const variant = original.clone();
    applySeaSubmersion(variant);
    entry = { variant, refs: 0 };
    cache.set(original, entry);
  }
  entry.refs += 1;
  return entry.variant;
}

/** 반납(refcount −1). 0 이 되면 variant 를 dispose 하고 캐시에서 지운다. */
export function releaseSeaVariant(original: Material): void {
  const entry = cache.get(original);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    cache.delete(original);
    entry.variant.dispose();
  }
}

/** 테스트 전용 — 현재 캐시 엔트리 수. */
export function seaVariantCacheSize(): number {
  return cache.size;
}
