import type { Object3D } from 'three';

/**
 * 자식 mesh 식별자 = `${modelId}::${meshPath}` 형식.
 *
 * - modelId는 createId() 결과(UUID-like)라 `::`을 포함하지 않는다.
 * - parseMeshId는 첫 `::`로만 split하여 modelId/meshPath를 분리한다.
 * - meshPath는 GLTF clone root에서 target mesh까지의 부모-자식 chain을
 *   `/`로 잇되, sibling 안정성을 위해 각 node는 `[index]name` 형식이다.
 *   (예: `[0]Armature/[1]Spine/[0]Hand.L`)
 */
const MESH_ID_SEPARATOR = '::';

export function makeMeshId(modelId: string, meshPath: string): string {
  return `${modelId}${MESH_ID_SEPARATOR}${meshPath}`;
}

export function parseMeshId(
  id: string,
): { modelId: string; meshPath: string } | null {
  const idx = id.indexOf(MESH_ID_SEPARATOR);
  if (idx < 0) return null;
  return {
    modelId: id.slice(0, idx),
    meshPath: id.slice(idx + MESH_ID_SEPARATOR.length),
  };
}

export function isMeshId(id: string): boolean {
  return id.includes(MESH_ID_SEPARATOR);
}

function nodeSegment(node: Object3D): string {
  const parent = node.parent;
  const index = parent ? parent.children.indexOf(node) : 0;
  const name = node.name || '';
  return `[${index}]${name}`;
}

/**
 * cloneRoot에서 target까지의 path를 sibling-index 안정 형식으로 만든다.
 * cloneRoot 자체는 path에 포함되지 않는다 (root는 modelId가 가리킴).
 * target이 cloneRoot의 자손이 아니면 null.
 */
export function getMeshPath(
  cloneRoot: Object3D,
  target: Object3D,
): string | null {
  if (target === cloneRoot) return '';

  const chain: Object3D[] = [];
  let cursor: Object3D | null = target;
  while (cursor && cursor !== cloneRoot) {
    chain.push(cursor);
    cursor = cursor.parent;
  }
  if (cursor !== cloneRoot) return null;

  chain.reverse();
  return chain.map(nodeSegment).join('/');
}

/**
 * meshPath를 따라 cloneRoot의 자손을 찾는다. 노드가 사라졌거나 index가
 * 어긋난 경우 null. (모델 파일이 업데이트되어 구조가 변하면 stale override는
 * silent skip 된다.)
 */
export function findMeshByPath(
  cloneRoot: Object3D,
  meshPath: string,
): Object3D | null {
  if (meshPath === '') return cloneRoot;

  let current: Object3D = cloneRoot;
  const segments = meshPath.split('/');
  for (const segment of segments) {
    const match = /^\[(\d+)\](.*)$/.exec(segment);
    if (!match) return null;
    const index = Number(match[1]);
    const name = match[2];
    const child = current.children[index];
    if (!child) return null;
    // name 검증은 보조적으로만 수행. index가 우선이지만 GLTF 구조가 크게
    // 바뀌어 우연히 자리만 채워진 다른 노드를 잘못 잡는 사고를 막는다.
    if ((child.name || '') !== name) {
      return null;
    }
    current = child;
  }
  return current;
}
