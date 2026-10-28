import { Mesh, type Material, type Object3D } from 'three';
import {
  buildStrandExtension,
  computeStrandExtensionMatrix,
  isWorldVisible,
  type CableSegment,
  type StrandExtension,
} from '../lib/scene-carry';

/**
 * 로프 연장 풀 — 운반 런타임의 케이블(훅 노드 + 트롤리 높이)마다 그 노드의
 * 로프 가닥을 트롤리까지 잇는 관 메쉬를 `parent` 아래에 둔다. 관은 노드의
 * 가닥 윗끝 단면을 위로 뽑은 것(`buildStrandExtension`)이고 재질·그림자
 * 설정은 모델 로프 메쉬의 것을 그대로 빌린다 — 가닥 수·굵기·색이 모델과 같다.
 *
 * 관 메쉬는 R3F 가 아니라 여기서 만든다: R3F 는 언마운트 때 메쉬의 geometry·
 * material 을 dispose 하는데, 빌린 재질은 모델 로프의 것이라 버리면 안 된다.
 * `dispose` 는 관 지오메트리만 버린다.
 *
 * three 객체를 받지만 React·R3F 를 모른다. 레이어(ui/scene-carry-layer)가
 * useFrame 에서 부르고 테스트는 Object3D 를 직접 만들어 돌린다.
 */

/** 관은 선택·바닥 판정 대상이 아니다 — 레이캐스트에서 빠진다. */
function skipRaycast(): void {}

function firstMaterial(mesh: Mesh): Material {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

export class SceneRopeExtensions {
  private readonly meshes: Mesh[] = [];
  /** 훅 노드 → 가닥 연장(못 만들면 null — 다시 시도하지 않는다). */
  private readonly extensions = new Map<Object3D, StrandExtension | null>();
  /** 관 메쉬를 다는 곳 — 레이어의 group. */
  private readonly parent: Object3D;

  constructor(parent: Object3D) {
    this.parent = parent;
  }

  /**
   * 케이블마다 관을 맞춘다. 남는 관은 숨긴다. 이번에 처음 연장을 만든 노드가
   * 있으면 true — 그 프레임은 그림자를 다시 그려야 한다(관이 새로 보인다).
   */
  update(cables: readonly CableSegment[]): boolean {
    let built = false;
    let used = 0;
    for (const cable of cables) {
      const node = cable.node;
      if (!node) continue;
      let extension = this.extensions.get(node);
      if (extension === undefined) {
        extension = buildStrandExtension(node);
        this.extensions.set(node, extension);
        built = true;
      }
      if (!extension || !isWorldVisible(extension.source)) continue;
      const mesh = this.meshAt(used, extension);
      if (
        !computeStrandExtensionMatrix(
          node,
          extension.baseY,
          cable.from.y,
          mesh.matrix,
        )
      ) {
        continue;
      }
      mesh.geometry = extension.geometry;
      mesh.material = firstMaterial(extension.source);
      mesh.castShadow = extension.source.castShadow;
      mesh.receiveShadow = extension.source.receiveShadow;
      mesh.matrixWorldNeedsUpdate = true;
      mesh.visible = true;
      used += 1;
    }
    for (let i = used; i < this.meshes.length; i += 1) {
      this.meshes[i].visible = false;
    }
    return built;
  }

  /** 보이는 관 수 — 테스트·진단용. */
  get visibleCount(): number {
    let n = 0;
    for (const mesh of this.meshes) if (mesh.visible) n += 1;
    return n;
  }

  /** 관 메쉬를 떼고 관 지오메트리를 버린다. 빌린 재질은 건드리지 않는다. */
  dispose(): void {
    for (const mesh of this.meshes) mesh.removeFromParent();
    this.meshes.length = 0;
    for (const extension of this.extensions.values()) {
      extension?.geometry.dispose();
    }
    this.extensions.clear();
  }

  private meshAt(index: number, extension: StrandExtension): Mesh {
    let mesh = this.meshes[index];
    if (!mesh) {
      mesh = new Mesh(extension.geometry, firstMaterial(extension.source));
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.raycast = skipRaycast;
      this.meshes[index] = mesh;
      this.parent.add(mesh);
    }
    return mesh;
  }
}
