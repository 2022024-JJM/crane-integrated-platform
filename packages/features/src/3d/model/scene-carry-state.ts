/**
 * 운반 상태 — "어느 운반 가능 모델(블록)이 어느 크레인 모델의 **어느 훅 노드**에
 * 붙어 있는가". 운반 런타임(scene-carry-runtime)이 쓰고, 충돌 감지가 운반 중인
 * 훅 메쉬↔블록 메쉬 쌍만 건너뛰는 데 읽는다 — 훅 블록이 블록 윗면에 닿은 채
 * 움직이는 것은 관통이 아니지만, 같은 크레인의 다리·거더가 운반 중인 블록을
 * 치는 것은 관통이라 보고해야 한다. 그래서 제외는 모델 쌍이 아니라 메쉬 쌍
 * 단위다.
 *
 * React 상태가 아니라 mutable Map — 프레임마다 읽히고 값이 바뀌는 일은 부착·
 * 분리 순간뿐이라 리렌더를 태울 이유가 없다.
 */
interface CarryEntry {
  carrierId: string;
  /** 블록을 든 훅들의 노드 mesh-path(크레인 루트 기준). 탠덤이면 두 훅의 합. */
  hookPaths: Set<string>;
}

const entries = new Map<string, CarryEntry>();

/** 메쉬 경로가 훅 노드 경로 자체이거나 그 아래인지. */
function isUnderHook(
  meshPath: string,
  hookPaths: ReadonlySet<string>,
): boolean {
  for (const hookPath of hookPaths) {
    if (meshPath === hookPath || meshPath.startsWith(`${hookPath}/`)) {
      return true;
    }
  }
  return false;
}

export const sceneCarryState = {
  /**
   * 블록을 크레인 모델의 훅에 붙인다. 같은 크레인의 다른 훅이 더 붙으면(탠덤)
   * 훅 노드 경로가 합쳐지고, 다른 크레인이면 덮어쓴다.
   */
  attach(
    carriedId: string,
    carrierId: string,
    hookNodePaths: readonly string[] = [],
  ): void {
    const entry = entries.get(carriedId);
    if (entry && entry.carrierId === carrierId) {
      for (const path of hookNodePaths) entry.hookPaths.add(path);
      return;
    }
    entries.set(carriedId, { carrierId, hookPaths: new Set(hookNodePaths) });
  },
  release(carriedId: string): void {
    entries.delete(carriedId);
  },
  carrierOf(carriedId: string): string | undefined {
    return entries.get(carriedId)?.carrierId;
  },
  isCarried(modelId: string): boolean {
    return entries.has(modelId);
  },
  /** 두 모델이 운반 중인 크레인↔블록 쌍인지(순서 무관). */
  isCarriedPair(a: string, b: string): boolean {
    return entries.get(a)?.carrierId === b || entries.get(b)?.carrierId === a;
  },
  /**
   * 메쉬 쌍이 "든 훅 노드의 메쉬 ↔ 운반 중인 블록의 메쉬" 인지(순서 무관).
   * 크레인의 다른 메쉬(다리·거더·트롤리 본체)↔블록은 false — 관통으로 본다.
   */
  isCarriedMeshPair(
    aId: string,
    aPath: string,
    bId: string,
    bPath: string,
  ): boolean {
    const byA = entries.get(aId);
    if (byA && byA.carrierId === bId) return isUnderHook(bPath, byA.hookPaths);
    const byB = entries.get(bId);
    if (byB && byB.carrierId === aId) return isUnderHook(aPath, byB.hookPaths);
    return false;
  },
  clear(): void {
    entries.clear();
  },
  get size(): number {
    return entries.size;
  },
};

/** 함수 참조가 고정된 판정 — 충돌 런타임에 한 번 꽂아 둔다. */
export function isCarriedPair(a: string, b: string): boolean {
  return sceneCarryState.isCarriedPair(a, b);
}

/** 함수 참조가 고정된 메쉬 쌍 판정 — 충돌 런타임의 메쉬 단위 제외. */
export function isCarriedMeshPair(
  aId: string,
  aPath: string,
  bId: string,
  bPath: string,
): boolean {
  return sceneCarryState.isCarriedMeshPair(aId, aPath, bId, bPath);
}
