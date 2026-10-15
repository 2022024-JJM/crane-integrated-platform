import {
  Box3,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import {
  ExtendedTriangle,
  OrientedBox,
  type HitPointInfo,
  type MeshBVH,
} from 'three-mesh-bvh';

/**
 * 씬 객체 충돌 감지의 기하 프리미티브 — 3단계(AABB → OBB → 삼각형) 각각의
 * 판정 함수. 스케줄링(어느 쌍을 언제 검사할지)은 features 의
 * scene-collision-runtime 이 맡고, 여기는 메쉬 둘을 받아 답만 낸다.
 *
 * three-mesh-bvh 접점은 이 파일뿐이다. `BufferGeometry.boundsTree` 는 전역
 * 타입 augment 없이 ModelMesh 가 유휴 시간에 붙이는 파생 데이터라(bvh-setup,
 * model-mesh 주석) 여기서만 캐스팅해 읽는다. 빌드는 하지 않는다 — 10만
 * 삼각형 메쉬 하나가 수백 ms 라 프레임 안에서 동기 빌드하면 화면이 멈춘다.
 *
 * 모든 함수는 모듈 스코프 스크래치 객체를 재사용해 프레임당 할당이 0 이다.
 * 결과를 보관하려면 호출자가 `target` 을 넘기거나 복사해야 한다.
 */

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

const _obbA = new OBB();
const _obbB = new OBB();
const _toA = new Matrix4();
const _hitA = {} as HitPointInfo;
const _hitB = {} as HitPointInfo;
const _boxA = new Box3();
const _boxB = new Box3();
const _center = new Vector3();
const _toB = new Matrix4();
const _leafBox = new OrientedBox(new Vector3(), new Vector3());
const _nodeBox = new Box3();
const _bOrientedInA = new OrientedBox(new Vector3(), new Vector3());

/**
 * drei `<Line>`(three-stdlib Line2/LineSegments2)은 Mesh 파생이라 순회에
 * 잡힌다 — 선택 박스·충돌 박스 자체가 충돌 대상이 되면 안 된다.
 */
function isLineMesh(object: Object3D): boolean {
  const flags = object as { isLine2?: boolean; isLineSegments2?: boolean };
  return flags.isLine2 === true || flags.isLineSegments2 === true;
}

/**
 * 충돌 판정 대상이 되는 메쉬인지. 라인·정점 없는 지오메트리·빈 박스는 제외.
 * `geometry.boundingBox` 가 없으면 여기서 한 번 계산한다(인스턴스 간 공유
 * 지오메트리라 1회 비용).
 */
export function isCollidableMesh(object: Object3D): object is Mesh {
  if (!(object instanceof Mesh) || isLineMesh(object)) return false;
  const geometry = object.geometry as BufferGeometry | undefined;
  if (!geometry || !geometry.getAttribute('position')) return false;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return geometry.boundingBox !== null && !geometry.boundingBox.isEmpty();
}

/** 노드 extras 의 LOD 레벨(지형 타일·모델 LOD 공통). 유한 숫자가 아니면 null. */
function lodLevelOf(object: Object3D): number | null {
  const lod = (object.userData as { lod?: unknown }).lod;
  return typeof lod === 'number' && Number.isFinite(lod) ? lod : null;
}

function collectInto(object: Object3D, out: Mesh[]): void {
  const lod = lodLevelOf(object);
  if (lod !== null && lod > 0) return;
  if (!object.visible && lod !== 0) return;
  if (isCollidableMesh(object)) out.push(object);
  for (const child of object.children) collectInto(child, out);
}

/**
 * `root` 아래 충돌 대상 메쉬를 `out` 에 모은다(`out` 은 비우고 재사용).
 * `visible=false` 서브트리는 통째로 빠진다 — 단 LOD 는 가시성과 무관하게
 * **항상 LOD0** 을 모은다. LOD>0 사본은 서브트리째 건너뛰고(BVH 를 만들지
 * 않아 삼각형 판정이 영영 불가), LOD0 노드는 SceneTerrainLod 가 거리에 따라
 * 숨겨 놓았어도 내려간다. raycast 가 항상 LOD0 을 보는 것과 같은 계약이라
 * 판정이 카메라 거리에 따라 달라지지 않는다.
 */
export function collectCollidableMeshes(root: Object3D, out: Mesh[]): Mesh[] {
  out.length = 0;
  collectInto(root, out);
  return out;
}

/** 메쉬의 로컬 boundingBox 를 `matrixWorld` 로 올린 월드 AABB. */
export function meshWorldBox(mesh: Mesh, target: Box3): Box3 {
  const geometry = mesh.geometry as BufferGeometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return target
    .copy(geometry.boundingBox as Box3)
    .applyMatrix4(mesh.matrixWorld);
}

/**
 * 두 메쉬의 월드 OBB(로컬 박스 × matrixWorld)가 겹치는지 — SAT 15축은
 * three OBB 가 내장한다. AABB 는 겹치지만 회전한 긴 붐처럼 실제로는 떨어진
 * 쌍을 삼각형 단계 전에 걸러 BVH 호출을 크게 줄인다.
 *
 * `margin` 을 주면 b 의 OBB 를 각 축으로 그만큼 부풀려 판정한다 — 억제 해제
 * 히스테리시스용. 간격이 정확히 margin 이면 닿은 것(겹침)으로 본다.
 * (three `intersectsOBB` 의 epsilon 인자는 회전 행렬 절댓값에 더하는 수치
 * 안정용이라 거리 여유로 쓸 수 없다.)
 */
export function meshObbsIntersect(a: Mesh, b: Mesh, margin = 0): boolean {
  const ga = a.geometry as BufferGeometry;
  const gb = b.geometry as BufferGeometry;
  if (!ga.boundingBox) ga.computeBoundingBox();
  if (!gb.boundingBox) gb.computeBoundingBox();
  _obbA.fromBox3(ga.boundingBox as Box3).applyMatrix4(a.matrixWorld);
  _obbB.fromBox3(gb.boundingBox as Box3).applyMatrix4(b.matrixWorld);
  if (Number.isFinite(margin) && margin > 0) _obbB.halfSize.addScalar(margin);
  return _obbA.intersectsOBB(_obbB);
}

export function hasBoundsTree(mesh: Mesh): boolean {
  return (mesh.geometry as BvhGeometry).boundsTree !== undefined;
}

/**
 * 삼각형 단위 정밀 교차. **양쪽 모두 BVH 가 있어야** 한다 — 상대 지오메트리에
 * boundsTree 가 없으면 three-mesh-bvh 가 리프마다 상대 삼각형을 전수 순회해
 * 사실상 쓸 수 없다. 하나라도 없으면 `null`(판정 불가)을 돌려주고, 빌드
 * 여부·재시도는 호출자가 정한다.
 *
 * 스킨 미적용 지오메트리 기준이라 SkinnedMesh 는 부정확하다. 현재 크레인
 * GLB 는 노드 transform 리깅(Empty 회전)이라 해당 없다.
 */
export function meshesIntersectExact(a: Mesh, b: Mesh): boolean | null {
  const ga = a.geometry as BvhGeometry;
  const gb = b.geometry as BvhGeometry;
  if (!ga.boundsTree || !gb.boundsTree) return null;
  // B 로컬 → 월드 → A 로컬. intersectsGeometry 의 두 번째 인자는 상대
  // 지오메트리를 BVH(A) 로컬 프레임으로 보내는 행렬이다.
  _toA.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  return ga.boundsTree.intersectsGeometry(gb, _toA);
}

/**
 * 두 메쉬의 삼각형 사이 최단 거리가 `maxDistance` **이하**인지(정확값 포함).
 * 억제 해제의 마지막 단계 — 단일 메쉬 크레인처럼 OBB 가 실루엣 전체를 감싸
 * 두 OBB 가 계속 겹쳐도, 삼각형끼리 떨어졌으면 "분리" 로 봐야 재충돌이
 * 다시 보고된다. 속이 빈 트러스 안에 상대가 들어와 있는 경우도 같다.
 *
 * three-mesh-bvh `closestPointToGeometry` 에 maxThreshold 를 주면 그 거리
 * 안의 노드 쌍만 탐색하고 없으면 null 로 곧바로 끝난다 — 관통 판정
 * (intersectsGeometry)과 비슷한 비용. 양쪽 BVH 가 필요하며 없으면 null.
 */
export function meshesWithinDistance(
  a: Mesh,
  b: Mesh,
  maxDistance: number,
): boolean | null {
  const ga = a.geometry as BvhGeometry;
  const gb = b.geometry as BvhGeometry;
  if (!ga.boundsTree || !gb.boundsTree) return null;
  const limit =
    Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : 0;
  _toA.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
  // maxThreshold 는 탐색 가지치기용일 뿐 결과를 걸러 주지 않는다 — 한계 밖의
  // 최근접점도 그대로 돌려주므로 거리는 직접 비교한다(정확값 포함). 가지치기가
  // `dist < maxThreshold` 라 정확값이 잘리지 않게 한 ulp 더 준다.
  const threshold = limit + Math.max(limit, 1) * Number.EPSILON * 4;
  const hit = ga.boundsTree.closestPointToGeometry(
    gb,
    _toA,
    _hitA,
    _hitB,
    0,
    threshold,
  );
  // 1.05 - 1 = 0.050000000000000044 같은 부동소수 잡음이 경계 정확값을
  // "넘김" 으로 뒤집지 않게 상대 허용치를 둔다.
  return hit !== null && hit.distance <= limit + Math.max(limit, 1) * 1e-9;
}

/**
 * 근사 접촉점 — 두 메쉬 월드 AABB 교집합의 중심. 교집합이 비면(OBB·삼각형은
 * 닿았지만 AABB 계산 순서상 어긋난 경우) 두 박스 중심의 중점으로 폴백.
 */
export function approxContactPoint(a: Mesh, b: Mesh, target: Vector3): Vector3 {
  meshWorldBox(a, _boxA);
  meshWorldBox(b, _boxB);
  _boxA.getCenter(target);
  _boxB.getCenter(_center);
  // intersect 는 _boxA 를 덮어쓰므로 중심을 먼저 뽑아 둔다.
  _boxA.intersect(_boxB);
  if (_boxA.isEmpty()) {
    return target.add(_center).multiplyScalar(0.5);
  }
  return _boxA.getCenter(target);
}

/**
 * 두 AABB 가 어느 한 축에서라도 `margin` **보다 더** 떨어져 있는지. 경계
 * 정확값(간격 = margin)은 아직 붙어 있는 것으로 본다 — 억제 해제 히스테리시스.
 */
export function boxesSeparated(a: Box3, b: Box3, margin: number): boolean {
  const m = Number.isFinite(margin) && margin > 0 ? margin : 0;
  return (
    a.max.x + m < b.min.x ||
    b.max.x + m < a.min.x ||
    a.max.y + m < b.min.y ||
    b.max.y + m < a.min.y ||
    a.max.z + m < b.min.z ||
    b.max.z + m < a.min.z
  );
}

/**
 * 분리 재검사를 **이어서 하는** 삼각형 거리 질의 — "두 메쉬의 삼각형 사이에
 * `margin` 이하로 가까운 쌍이 하나라도 있는가" 를 A 의 BVH 리프 단위로
 * 쪼개 `step` 마다 예산 안에서만 진행한다. `meshesWithinDistance` 와 답은
 * 같지만(정확값 포함, 관통은 거리 0) 한 호출이 프레임을 넘기지 않는다.
 *
 * 왜 필요한가: three-mesh-bvh 의 `closestPointToGeometry` 는 쪼갤 수 없고,
 * 트러스끼리 엇갈려 들어간 크레인 쌍은 노드 쌍이 수천 개라 한 번에 수백 ms
 * 다. 억제된 쌍은 OBB 가 겹치는 동안 주기적으로 이 판정을 받으므로 그
 * 비용이 그대로 프레임 멈춤이 됐다.
 *
 * 진행 단위는 A 리프 하나: 리프 박스(margin 만큼 부풀림)를 B 로컬 OBB 로
 * 보내 B BVH 를 가지치기하고, 닿는 B 리프의 삼각형과 A 리프 삼각형의 거리를
 * 잰다. `margin` 이하가 하나라도 나오면 즉시 'near'. 변환은 step 마다 현재
 * matrixWorld 로 다시 읽으므로, 여러 틱에 걸친 결과는 "각 리프를 본 시점의
 * 자세" 기준이다 — margin 히스테리시스가 그 사이 미세 이동을 덮고, 틀리면
 * 다음 dirty 틱의 교차 판정이 바로잡는다.
 *
 * 거리는 B 로컬 프레임에서 잰다(`meshesWithinDistance` 는 A 로컬). 모델
 * 스케일이 1 이 아니면 margin 도 그만큼 스케일된다 — 기존과 같은 한계다.
 */
export type SeparationStep = 'near' | 'separated' | 'pending';

export class SeparationQuery {
  private a: Mesh | null = null;
  private b: Mesh | null = null;
  private margin = 0;
  /** A 리프 [offset, count, offset, count, …] — B 전체 OBB 근처만. */
  private readonly leaves: number[] = [];
  private cursor = 0;
  private readonly tris: ExtendedTriangle[] = [];
  private triCount = 0;

  get active(): boolean {
    return this.a !== null;
  }

  /** 진행 중인 질의를 버린다. */
  reset(): void {
    this.a = null;
    this.b = null;
    this.leaves.length = 0;
    this.cursor = 0;
  }

  /**
   * 새 질의를 연다. 한쪽이라도 BVH 가 없으면 false(판정 불가 — 호출자가
   * 보수적으로 "붙음" 으로 둔다). 리프 수집은 박스 판정뿐이라 싸다.
   */
  begin(a: Mesh, b: Mesh, margin: number): boolean {
    this.reset();
    const ga = a.geometry as BvhGeometry;
    const gb = b.geometry as BvhGeometry;
    if (!ga.boundsTree || !gb.boundsTree) return false;
    if (!gb.boundingBox) gb.computeBoundingBox();
    this.a = a;
    this.b = b;
    this.margin = Number.isFinite(margin) && margin > 0 ? margin : 0;
    const m = this.margin;
    // B 의 로컬 박스(margin 부풀림)를 A 로컬 OBB 로 — A 리프 가지치기.
    _toA.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
    const bb = gb.boundingBox as Box3;
    _bOrientedInA.set(
      _boxB.min.copy(bb.min).subScalar(m),
      _boxB.max.copy(bb.max).addScalar(m),
      _toA,
    );
    _bOrientedInA.needsUpdate = true;
    const leaves = this.leaves;
    ga.boundsTree.shapecast({
      intersectsBounds: (box) => _bOrientedInA.intersectsBox(box),
      intersectsRange: (offset, count) => {
        leaves.push(offset, count);
        return false;
      },
    });
    return true;
  }

  /**
   * 리프를 하나 이상 진행한다. 첫 리프는 항상 보고, 그 뒤로는 `clock()` 이
   * 시작 시각 + `budgetMs` 에 닿으면 'pending' 으로 돌아온다. 'near' 와
   * 'separated' 는 질의를 닫는다(다시 쓰려면 begin).
   */
  step(budgetMs: number, clock: () => number): SeparationStep {
    const a = this.a;
    const b = this.b;
    if (a === null || b === null) return 'separated';
    const t0 = clock();
    const bvhA = (a.geometry as BvhGeometry).boundsTree as MeshBVH;
    const bvhB = (b.geometry as BvhGeometry).boundsTree as MeshBVH;
    // A 로컬 → B 로컬. step 마다 현재 자세로.
    _toB.copy(b.matrixWorld).invert().multiply(a.matrixWorld);
    const m = this.margin;
    const tolerance = m + Math.max(m, 1) * 1e-9;
    const leaves = this.leaves;
    while (this.cursor < leaves.length) {
      const offset = leaves[this.cursor];
      const count = leaves[this.cursor + 1];
      this.cursor += 2;
      this.loadLeaf(bvhA, offset, count);
      if (this.triCount === 0) continue;
      const hit = bvhB.shapecast({
        intersectsBounds: (box) => {
          _nodeBox.copy(box).expandByScalar(m);
          return _leafBox.intersectsBox(_nodeBox);
        },
        intersectsTriangle: (tri) => {
          for (let i = 0; i < this.triCount; i += 1) {
            if (this.tris[i].distanceToTriangle(tri) <= tolerance) return true;
          }
          return false;
        },
      });
      if (hit) {
        this.reset();
        return 'near';
      }
      if (clock() - t0 >= budgetMs) return 'pending';
    }
    this.reset();
    return 'separated';
  }

  /** A 리프의 삼각형을 B 로컬로 옮겨 tris 에, 리프 OBB(margin 포함)를 _leafBox 에. */
  private loadLeaf(bvh: MeshBVH, offset: number, count: number): void {
    const geometry = bvh.geometry;
    // 0.8 의 d.ts 에 빠진 공개 메서드 — indirect 빌드면 간접 버퍼를 거친다.
    const resolve = (
      bvh as unknown as { resolveTriangleIndex(i: number): number }
    ).resolveTriangleIndex;
    const pos = geometry.getAttribute('position');
    const index = geometry.index;
    while (this.tris.length < count) this.tris.push(new ExtendedTriangle());
    _boxA.makeEmpty();
    for (let i = 0; i < count; i += 1) {
      const t = resolve.call(bvh, offset + i);
      const tri = this.tris[i];
      const i0 = index ? index.getX(3 * t) : 3 * t;
      const i1 = index ? index.getX(3 * t + 1) : 3 * t + 1;
      const i2 = index ? index.getX(3 * t + 2) : 3 * t + 2;
      tri.a.fromBufferAttribute(pos, i0).applyMatrix4(_toB);
      tri.b.fromBufferAttribute(pos, i1).applyMatrix4(_toB);
      tri.c.fromBufferAttribute(pos, i2).applyMatrix4(_toB);
      tri.needsUpdate = true;
      _boxA.expandByPoint(tri.a).expandByPoint(tri.b).expandByPoint(tri.c);
    }
    this.triCount = count;
    _boxA.expandByScalar(this.margin);
    // 이미 B 로컬 좌표라 단위 행렬.
    _leafBox.set(_boxA.min, _boxA.max, _identity);
    _leafBox.needsUpdate = true;
  }
}

const _identity = new Matrix4();
