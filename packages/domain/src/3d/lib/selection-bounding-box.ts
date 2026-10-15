import {
  MathUtils,
  Matrix4,
  Mesh,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type Object3D,
} from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  convexHullOfStrided,
  convexHullXZ,
  fitFootprintCornersXZ,
} from './xz-footprint';

/**
 * 선택 박스(노란 12모서리 라인)의 점 계산.
 *
 * 원칙: 점은 **박스가 마운트되는 Object3D 의 로컬 좌표**로 만든다. 박스 라인은
 * 그 객체의 자식으로 씬 그래프에 들어가므로, 객체가 기즈모로 움직이든 리그
 * 드라이버로 회전하든 별도 동기화 없이 상속으로 따라간다.
 *
 * 이전 구현은 대상의 transform 을 항등으로 리셋하고 `Box3.setFromObject` 로
 * 월드 박스를 잰 뒤 되돌렸다. 대상이 씬 루트 직계(모델 clone)일 때만 우연히
 * 맞았고, 모델 안쪽 노드를 넘기면 노드 오프셋을 잃고 조상 transform 이 두 번
 * 적용돼 엉뚱한 곳에 그려졌다. 여기서는 대상을 mutate 하지 않고 각 메쉬의
 * `matrixWorld` 를 대상의 `matrixWorld` 역행렬로 되돌려 로컬 프레임에서 합친다.
 *
 * 박스는 높이(Y)는 로컬 축 그대로, 바닥(XZ)은 정점 발자국의 최소 면적 사각형
 * 방향으로 눕힌다. 지도 GLB 는 건물 방향이 노드 회전이 아니라 정점에 들어 있고
 * 북쪽이 로컬 −Z 라 야드 격자가 로컬 축에 비스듬하다 — 축 정렬 박스는 건물을
 * 사선으로 감싸 몇 배 넓어진다. 축에 나란히 만든 모델은 축 정렬 박스가 최소라
 * 그대로 남는다(ORIENTED_BOX_MIN_GAIN).
 */

/**
 * 회전 박스를 쓰는 최소 이득 — 발자국의 최소 면적 사각형이 축 정렬 사각형보다
 * 이 비율 이상 작을 때만 돌린다. 모양이 거의 축에 맞는 객체의 박스가 잡음 같은
 * 몇 도로 돌아가지 않게 한다.
 */
export const ORIENTED_BOX_MIN_GAIN = 0.1;

/** 상대 행렬이 Y축 회전·배율·이동뿐인지 볼 때의 허용 오차(열 길이 대비). */
const YAW_ONLY_EPSILON = 1e-6;

const boundingBoxPointsCache = new WeakMap<Object3D, Vector3Tuple[] | null>();

type PositionAttribute = BufferAttribute | InterleavedBufferAttribute;

/** 위치 속성 하나의 발자국 — XZ 볼록 껍질과 Y 범위(속성 공간, 정규화 해제 후). */
interface AttributeFootprint {
  hull: number[];
  /** 유한한 y 가 없으면 Infinity / -Infinity. */
  minY: number;
  maxY: number;
}

/**
 * 위치 속성별 발자국 캐시. 클론·LOD 사본이 같은 속성을 공유하므로 지도 한 장은
 * 처음 한 번만 정점을 돈다 — 그 뒤 노드·전체 선택은 껍질 점(수십 개)만 옮긴다.
 * geometry.boundingBox 처럼 인덱스와 무관하게 속성의 모든 정점을 본다.
 */
const attributeFootprintCache = new WeakMap<
  PositionAttribute,
  AttributeFootprint
>();

/**
 * drei `<Line>` 은 three-stdlib `Line2`/`LineSegments2`(둘 다 Mesh 파생)라
 * 메쉬 순회에 잡힌다. `segments` 모드는 `LineSegments2` 이고 `isLine2` 를
 * 갖지 않으므로 두 플래그를 모두 본다.
 */
function isSelectionLine(object: Object3D): boolean {
  const flags = object as { isLine2?: boolean; isLineSegments2?: boolean };
  return flags.isLine2 === true || flags.isLineSegments2 === true;
}

function isInterleaved(
  attribute: PositionAttribute,
): attribute is InterleavedBufferAttribute {
  return (
    (attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute ===
    true
  );
}

function getAttributeFootprint(
  attribute: PositionAttribute,
): AttributeFootprint {
  const cached = attributeFootprintCache.get(attribute);
  if (cached) return cached;
  const array = isInterleaved(attribute)
    ? attribute.data.array
    : attribute.array;
  const stride = isInterleaved(attribute)
    ? attribute.data.stride
    : attribute.itemSize;
  const offset = isInterleaved(attribute) ? attribute.offset : 0;
  // 정규화 해제는 양의 배율(부호형은 −1 하한)이라 원본 정수로 껍질·범위를
  // 구한 뒤 결과 값만 풀어도 같다 — 정수 그대로 묶어 정렬하는 빠른 길을 탄다.
  // 성분 하나라도 비유한값인 정점은 발자국·높이 둘 다에서 뺀다.
  const raw = convexHullOfStrided(
    array,
    attribute.count,
    stride,
    offset,
    offset + 2,
    offset + 1,
  );
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0, o = offset; i < attribute.count; i += 1, o += stride) {
    const y = array[o + 1];
    if (
      !Number.isFinite(array[o]) ||
      !Number.isFinite(y) ||
      !Number.isFinite(array[o + 2])
    ) {
      continue;
    }
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // three 의 getX 가 정규화 속성에 쓰는 함수 그대로(지원 배열도 같다).
  const unpack = (value: number) =>
    attribute.normalized
      ? MathUtils.denormalize(
          value,
          array as Parameters<typeof MathUtils.denormalize>[1],
        )
      : value;
  const footprint: AttributeFootprint = {
    hull: attribute.normalized ? raw.map(unpack) : raw,
    minY: Number.isFinite(minY) ? unpack(minY) : minY,
    maxY: Number.isFinite(maxY) ? unpack(maxY) : maxY,
  };
  attributeFootprintCache.set(attribute, footprint);
  return footprint;
}

/**
 * 상대 행렬이 x·z 와 y 를 섞지 않는지(Y축 회전·배율·이동·XZ 기울임만). 그러면
 * XZ 투영과 변환의 순서를 바꿔도 같아 속성 공간의 껍질을 그대로 옮길 수 있다.
 */
function isYawOnly(e: ArrayLike<number>): boolean {
  const colX = Math.hypot(e[0], e[1], e[2]);
  const colY = Math.hypot(e[4], e[5], e[6]);
  const colZ = Math.hypot(e[8], e[9], e[10]);
  return (
    Math.abs(e[1]) <= YAW_ONLY_EPSILON * colX &&
    Math.abs(e[9]) <= YAW_ONLY_EPSILON * colZ &&
    Math.abs(e[4]) <= YAW_ONLY_EPSILON * colY &&
    Math.abs(e[6]) <= YAW_ONLY_EPSILON * colY
  );
}

/**
 * `object` 하위 메쉬들을 감싸는 박스를 `object` 로컬 프레임에서 구해 12모서리
 * 24점 배열로 만든다 — 높이는 로컬 Y 축, 바닥은 발자국에 맞춰 Y 축으로 돌린
 * 사각형. 메쉬가 없으면 `null`. 대상의 transform 은 건드리지 않는다.
 */
export function computeLocalBoundingBoxPoints(
  object: Object3D,
): Vector3Tuple[] | null {
  object.updateWorldMatrix(true, true);

  const toLocal = new Matrix4().copy(object.matrixWorld).invert();
  const relative = new Matrix4();
  // 메쉬별 껍질 점을 대상 프레임 XZ 로 모은 것 — 마지막에 한 번 더 껍질을 낸다.
  const footprint: number[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  const includeY = (y: number) => {
    if (!Number.isFinite(y)) return;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  object.traverse((child) => {
    if (!(child instanceof Mesh) || isSelectionLine(child)) return;
    const geometry = child.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    const position = geometry.getAttribute('position') as
      | PositionAttribute
      | undefined;
    if (!position || position.itemSize < 3) return;
    relative.multiplyMatrices(toLocal, child.matrixWorld);
    const e = relative.elements;

    if (isYawOnly(e)) {
      const { hull, minY: y0, maxY: y1 } = getAttributeFootprint(position);
      for (let i = 0; i < hull.length; i += 2) {
        const x = hull[i];
        const z = hull[i + 1];
        footprint.push(
          e[0] * x + e[8] * z + e[12],
          e[2] * x + e[10] * z + e[14],
        );
      }
      includeY(e[5] * y0 + e[13]);
      includeY(e[5] * y1 + e[13]);
      return;
    }

    // 기울어진 메쉬(리그 관절 등) — 정점을 대상 프레임으로 옮겨 그 자리에서
    // 껍질을 구한다. 이런 메쉬는 모델 부품이라 정점이 적다.
    const count = position.count;
    const xz = new Float64Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      xz[i * 2] = e[0] * x + e[4] * y + e[8] * z + e[12];
      xz[i * 2 + 1] = e[2] * x + e[6] * y + e[10] * z + e[14];
      includeY(e[1] * x + e[5] * y + e[9] * z + e[13]);
    }
    const hull = convexHullOfStrided(xz, count, 2, 0, 1);
    for (const value of hull) footprint.push(value);
  });

  if (footprint.length === 0 || !(minY <= maxY)) return null;

  const corners = fitFootprintCornersXZ(
    convexHullXZ(footprint),
    ORIENTED_BOX_MIN_GAIN,
  );
  if (!corners) return null;
  const bottom = corners.map(([x, z]): Vector3Tuple => [x, minY, z]);
  const top = corners.map(([x, z]): Vector3Tuple => [x, maxY, z]);

  // 12 모서리: bottom 4 + top 4 + vertical 4
  const points: Vector3Tuple[] = [];
  for (let i = 0; i < 4; i += 1) points.push(bottom[i], bottom[(i + 1) % 4]);
  for (let i = 0; i < 4; i += 1) points.push(top[i], top[(i + 1) % 4]);
  for (let i = 0; i < 4; i += 1) points.push(bottom[i], top[i]);
  return points;
}

/**
 * 객체별로 캐시된 동일 참조를 돌려준다 — drei `<Line>` 은 points 참조가 바뀌면
 * geometry 를 다시 만든다. 로컬 프레임 박스는 대상 자신의 transform 에 불변이라
 * 대상이 움직여도 캐시가 유효하다.
 */
export function getCachedLocalBoundingBoxPoints(
  object: Object3D,
): Vector3Tuple[] | null {
  const cached = boundingBoxPointsCache.get(object);
  if (cached !== undefined) {
    return cached;
  }
  const points = computeLocalBoundingBoxPoints(object);
  boundingBoxPointsCache.set(object, points);
  return points;
}
