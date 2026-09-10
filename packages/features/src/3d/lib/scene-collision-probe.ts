import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import {
  collectCollidableMeshes,
  getMeshPath,
  meshesIntersectExact,
  meshesWithinDistance,
  meshObbsIntersect,
  meshWorldBox,
} from '@crane/domain/3d';
import { MIN_MESH_EXTENT, SEPARATION_MARGIN } from './scene-collision-pairs';

/**
 * 씬 객체 충돌의 **판정 캐스케이드** — 모델 AABB → 메쉬 AABB → OBB(SAT) →
 * 삼각형(BVH). 순수 함수 모음이고 스케줄링은 하지 않는다.
 *
 * 사후 감지(scene-collision-runtime)와 예측(scene-collision-prediction-runtime)
 * 이 **같은 캐스케이드를 공유해야** 한다. 각자 구현하면 임계·후보 선별이
 * 조금만 어긋나도 "예측은 났는데 감지는 없다"(또는 반대)가 되어 두 기능의
 * 신뢰가 함께 무너진다. 그래서 판정만 여기로 모으고, 두 소비자는 서로 다른
 * 스케줄링(감지는 기준선·억제·변화 감지·예산 큐, 예측은 무상태 시간 사다리)만
 * 각자 가진다.
 *
 * BVH 는 여기서 빌드하지 않는다(collision-volumes 주석) — 10만 삼각형 하나가
 * 수백 ms 라 프레임 안 동기 빌드는 화면을 세운다. 없으면 `'no-bvh'` 를
 * 돌려주고 그 뒤 정책(재시도할지, 보수적으로 볼지)은 호출자가 정한다.
 *
 * 모든 함수가 모듈 스코프 스크래치를 재사용해 프레임당 할당이 0 이다. 그래서
 * **재진입 불가** — 한 호출이 끝난 뒤 다음 호출을 해야 한다(두 소비자는 각자
 * 다른 useFrame 콜백에서 순차 호출하므로 겹치지 않는다).
 */

/** 검사 대상 메쉬 하나. `box` 는 월드 AABB 캐시(호출자가 갱신 시점을 정한다). */
export interface ProbeMesh {
  mesh: Mesh;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
  box: Box3;
}

/** 모델 하나의 검사 단위. `box` 는 메쉬 박스들의 합집합. */
export interface ProbeEntry {
  meshes: ProbeMesh[];
  box: Box3;
}

/** `probeEntryPair` 가 'hit' 일 때 채우는 출력 슬롯. */
export interface ProbeHitMeshes {
  a: ProbeMesh | null;
  b: ProbeMesh | null;
}

export type ProbeResult = 'hit' | 'clear' | 'no-bvh';

const _meshScratch: Mesh[] = [];
const _box = new Box3();
const _size = new Vector3();
const _candA: ProbeMesh[] = [];
const _candB: ProbeMesh[] = [];
const _marginBox = new Box3();

/**
 * `root` 아래 검사 대상 메쉬 목록을 만든다. 경로를 못 구하는 메쉬와 월드
 * 크기가 `MIN_MESH_EXTENT` 미만인 것(볼트·라벨 앵커)은 뺀다.
 *
 * 크기 판정에 현재 matrixWorld 가 필요하므로 호출 시점에 트리 행렬이 최신
 * 이어야 한다.
 */
export function buildProbeMeshes(root: Object3D): ProbeMesh[] {
  const meshes: ProbeMesh[] = [];
  for (const mesh of collectCollidableMeshes(root, _meshScratch)) {
    const nodePath = getMeshPath(root, mesh);
    if (nodePath === null) continue;
    meshWorldBox(mesh, _box);
    if (_box.getSize(_size).length() < MIN_MESH_EXTENT) continue;
    meshes.push({ mesh, nodePath, box: new Box3() });
  }
  _meshScratch.length = 0;
  return meshes;
}

/** 메쉬 박스들의 합집합을 `entry.box` 에 다시 쓴다. */
export function unionProbeBox(entry: ProbeEntry): void {
  entry.box.makeEmpty();
  for (const m of entry.meshes) entry.box.union(m.box);
}

/**
 * 모든 메쉬의 월드 AABB 를 다시 재고 합집합까지 갱신한다. 변화 감지 없이
 * 전부 다시 재는 경로(예측처럼 매 평가에서 자세가 통째로 바뀌는 경우)용이다.
 * 감지 런타임은 변화한 메쉬만 재고 `unionProbeBox` 만 부른다.
 */
export function refreshProbeBoxes(entry: ProbeEntry): void {
  for (const m of entry.meshes) meshWorldBox(m.mesh, m.box);
  unionProbeBox(entry);
}

/**
 * 모델 AABB 가 겹친 두 항목의 메쉬 단위 검사. 'hit' 이면 `out` 에 부딪힌
 * 메쉬 쌍이 담긴다.
 *
 * 삼각형 판정이 불가한(BVH 미준비) 쌍이 하나라도 있고 확정 hit 이 없으면
 * `'no-bvh'` — 호출자가 "나중에 다시 본다"(감지)와 "이번엔 판단하지 않는다"
 * (예측) 중 무엇을 할지 정한다.
 */
export function probeEntryPair(
  a: ProbeEntry,
  b: ProbeEntry,
  out: ProbeHitMeshes,
): ProbeResult {
  out.a = null;
  out.b = null;
  _candA.length = 0;
  _candB.length = 0;
  for (const m of a.meshes) {
    if (m.box.intersectsBox(b.box)) _candA.push(m);
  }
  for (const m of b.meshes) {
    if (m.box.intersectsBox(a.box)) _candB.push(m);
  }
  let bvhMissing = false;
  for (const ma of _candA) {
    for (const mb of _candB) {
      if (!ma.box.intersectsBox(mb.box)) continue;
      if (!meshObbsIntersect(ma.mesh, mb.mesh)) continue;
      const exact = meshesIntersectExact(ma.mesh, mb.mesh);
      if (exact === null) {
        bvhMissing = true;
        continue;
      }
      if (exact) {
        out.a = ma;
        out.b = mb;
        return 'hit';
      }
    }
  }
  return bvhMissing ? 'no-bvh' : 'clear';
}

/**
 * 두 항목이 **메쉬 단위로** 떨어졌는지. 모델 전체 AABB 는 크레인처럼 길고 큰
 * 모델끼리 붐이 상대 위를 지나는 동안 계속 겹쳐 있어, 그것을 기준으로 하면
 * 메쉬는 떨어졌는데도 억제가 영영 풀리지 않는다(재충돌 미보고).
 *
 * 후보 메쉬 쌍 중 하나라도 "AABB 를 `SEPARATION_MARGIN` 만큼 넓혀도 겹치고,
 * 같은 margin 으로 부풀린 OBB 도 교차하고, 삼각형 최단 거리까지 margin
 * 이하" 면 아직 붙은 것이다. 카탈로그 크레인은 대부분 단일 메쉬라 OBB 가
 * 실루엣 전체를 감싸 두 OBB 가 늘 겹치므로 삼각형 단계가 최종 판정이다.
 * margin 이 경계 떨림을 막는 히스테리시스다.
 *
 * BVH 가 아직 없으면 보수적으로 "붙음"(= 분리 아님) — 빌드되면 호출자가 다시
 * 본다.
 */
export function probeEntriesSeparated(a: ProbeEntry, b: ProbeEntry): boolean {
  _marginBox.copy(b.box).expandByScalar(SEPARATION_MARGIN);
  if (!a.box.intersectsBox(_marginBox)) return true;
  _candA.length = 0;
  _candB.length = 0;
  for (const m of a.meshes) {
    if (m.box.intersectsBox(_marginBox)) _candA.push(m);
  }
  _marginBox.copy(a.box).expandByScalar(SEPARATION_MARGIN);
  for (const m of b.meshes) {
    if (m.box.intersectsBox(_marginBox)) _candB.push(m);
  }
  for (const ma of _candA) {
    _marginBox.copy(ma.box).expandByScalar(SEPARATION_MARGIN);
    for (const mb of _candB) {
      if (!_marginBox.intersectsBox(mb.box)) continue;
      if (!meshObbsIntersect(ma.mesh, mb.mesh, SEPARATION_MARGIN)) continue;
      const near = meshesWithinDistance(ma.mesh, mb.mesh, SEPARATION_MARGIN);
      if (near === null || near) return false;
    }
  }
  return true;
}
