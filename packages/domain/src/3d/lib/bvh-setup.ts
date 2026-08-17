import { BufferGeometry, Mesh } from 'three';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';

/**
 * three-mesh-bvh 전역 patch.
 *
 * three.js의 기본 raycaster는 mesh의 모든 triangle을 brute-force 순회한다.
 * three-mesh-bvh는 각 geometry에 BVH(Bounding Volume Hierarchy)를 부착해
 * O(log n)에 가깝게 raycast 한다. import 한 번으로 모든 mesh가 가속된다.
 *
 * - `Mesh.prototype.raycast = acceleratedRaycast`: 모든 raycast가 BVH 사용
 * - `BufferGeometry.prototype.computeBoundsTree`: 사용처에서 BVH 빌드 트리거
 * - 클릭 hit-test, drop raycast 등이 자동 가속된다
 *
 * 이 모듈은 side-effect import 전용이다. 한 번만 import 되도록 ModelMesh의
 * 최상단에서 import 해 둔다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;
