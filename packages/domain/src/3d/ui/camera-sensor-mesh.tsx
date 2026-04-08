import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  type Group,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import '../lib/bvh-setup';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { getSceneOccluders } from '../lib/scene-occluder-registry';
import { degToRad } from '../lib/math-utils';
import type { SavedCameraSensorInfo } from '../model/sensor-types';

// sensor simulation2의 CameraMesh를 도메인으로 옮긴 버전.
// 핵심: NDC unproject + raycast로 프러스텀 면의 near/far 좌표를 매 frame
// 갱신, 그 사이를 line segments로 그려 와이어프레임 구성.

const CAMERA_FRUSTUM_RAYCAST_FIRST_HIT_ONLY = true;

const CAMERA_BODY_SIZE: [number, number, number] = [0.45, 0.3, 0.3];
const LENS_RADIUS = 0.07;
const LENS_LENGTH = 0.15;
const LENS_SEGMENTS = 24;
const LENS_OFFSET_Z = -0.22;

const CAMERA_BODY_COLOR = '#dddddd';
const LENS_COLOR = '#333333';
const FRUSTUM_COLOR = '#22d3ee';
const FRUSTUM_OPACITY = 0.16;
const FRUSTUM_GRID_OPACITY = 0.9;

type FrustumLineSegment = readonly [number, number];

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateProjectionRatio(horizontalFov: number, verticalFov: number) {
  const horizontalHalfAngle = degreesToRadians(horizontalFov / 2);
  const verticalHalfAngle = degreesToRadians(verticalFov / 2);
  const ratio =
    Math.tan(horizontalHalfAngle) / Math.tan(verticalHalfAngle);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return ratio;
}

function gridIndex(i: number, j: number, segmentX: number) {
  return j * (segmentX + 1) + i;
}

function pushQuad(
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  flip = false,
) {
  if (flip) {
    indices.push(a, c, b, a, d, c);
    return;
  }
  indices.push(a, b, c, a, c, d);
}

function createFrustumGeometry(segmentX: number, segmentY: number) {
  const gridCount = (segmentX + 1) * (segmentY + 1);
  const positions = new Float32Array(gridCount * 2 * 3);
  const indices: number[] = [];
  const nearOffset = 0;
  const farOffset = gridCount;

  for (let j = 0; j < segmentY; j += 1) {
    for (let i = 0; i < segmentX; i += 1) {
      const n00 = nearOffset + gridIndex(i, j, segmentX);
      const n10 = nearOffset + gridIndex(i + 1, j, segmentX);
      const n11 = nearOffset + gridIndex(i + 1, j + 1, segmentX);
      const n01 = nearOffset + gridIndex(i, j + 1, segmentX);
      const f00 = farOffset + gridIndex(i, j, segmentX);
      const f10 = farOffset + gridIndex(i + 1, j, segmentX);
      const f11 = farOffset + gridIndex(i + 1, j + 1, segmentX);
      const f01 = farOffset + gridIndex(i, j + 1, segmentX);
      pushQuad(indices, n00, n10, n11, n01);
      pushQuad(indices, f00, f10, f11, f01, true);
    }
  }
  for (let i = 0; i < segmentX; i += 1) {
    pushQuad(
      indices,
      nearOffset + gridIndex(i, 0, segmentX),
      nearOffset + gridIndex(i + 1, 0, segmentX),
      farOffset + gridIndex(i + 1, 0, segmentX),
      farOffset + gridIndex(i, 0, segmentX),
    );
    pushQuad(
      indices,
      nearOffset + gridIndex(i + 1, segmentY, segmentX),
      nearOffset + gridIndex(i, segmentY, segmentX),
      farOffset + gridIndex(i, segmentY, segmentX),
      farOffset + gridIndex(i + 1, segmentY, segmentX),
    );
  }
  for (let j = 0; j < segmentY; j += 1) {
    pushQuad(
      indices,
      nearOffset + gridIndex(0, j + 1, segmentX),
      nearOffset + gridIndex(0, j, segmentX),
      farOffset + gridIndex(0, j, segmentX),
      farOffset + gridIndex(0, j + 1, segmentX),
    );
    pushQuad(
      indices,
      nearOffset + gridIndex(segmentX, j, segmentX),
      nearOffset + gridIndex(segmentX, j + 1, segmentX),
      farOffset + gridIndex(segmentX, j + 1, segmentX),
      farOffset + gridIndex(segmentX, j, segmentX),
    );
  }

  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFrustumGridSegments(segmentX: number, segmentY: number) {
  const gridCount = (segmentX + 1) * (segmentY + 1);
  const nearOffset = 0;
  const farOffset = gridCount;
  const segments: FrustumLineSegment[] = [];
  const segmentKeys = new Set<string>();

  function addSegment(fromIndex: number, toIndex: number) {
    const a = Math.min(fromIndex, toIndex);
    const b = Math.max(fromIndex, toIndex);
    const key = `${a}:${b}`;
    if (segmentKeys.has(key)) return;
    segmentKeys.add(key);
    segments.push([fromIndex, toIndex]);
  }

  for (let j = 0; j <= segmentY; j += 1) {
    for (let i = 0; i < segmentX; i += 1) {
      addSegment(
        nearOffset + gridIndex(i, j, segmentX),
        nearOffset + gridIndex(i + 1, j, segmentX),
      );
      addSegment(
        farOffset + gridIndex(i, j, segmentX),
        farOffset + gridIndex(i + 1, j, segmentX),
      );
    }
  }
  for (let i = 0; i <= segmentX; i += 1) {
    for (let j = 0; j < segmentY; j += 1) {
      addSegment(
        nearOffset + gridIndex(i, j, segmentX),
        nearOffset + gridIndex(i, j + 1, segmentX),
      );
      addSegment(
        farOffset + gridIndex(i, j, segmentX),
        farOffset + gridIndex(i, j + 1, segmentX),
      );
    }
  }
  // 코너에 near→far 연결
  addSegment(
    nearOffset + gridIndex(0, 0, segmentX),
    farOffset + gridIndex(0, 0, segmentX),
  );
  addSegment(
    nearOffset + gridIndex(segmentX, 0, segmentX),
    farOffset + gridIndex(segmentX, 0, segmentX),
  );
  addSegment(
    nearOffset + gridIndex(0, segmentY, segmentX),
    farOffset + gridIndex(0, segmentY, segmentX),
  );
  addSegment(
    nearOffset + gridIndex(segmentX, segmentY, segmentX),
    farOffset + gridIndex(segmentX, segmentY, segmentX),
  );
  return segments;
}

function createFrustumLineGeometry(segmentCount: number) {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(segmentCount * 2 * 3);
  geometry.setAttribute(
    'position',
    new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
  );
  return geometry;
}

function syncCameraProjection(
  camera: PerspectiveCamera,
  sensor: SavedCameraSensorInfo,
) {
  camera.fov = sensor.verticalFov;
  camera.aspect = calculateProjectionRatio(
    sensor.horizontalFov,
    sensor.verticalFov,
  );
  camera.near = sensor.near;
  camera.far = sensor.far;
  camera.updateProjectionMatrix();
}

interface CameraSensorMeshProps {
  sensor: SavedCameraSensorInfo;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function CameraSensorMesh({
  sensor,
  isSelected = false,
  onSelect,
}: CameraSensorMeshProps) {
  const groupRef = useRef<Group>(null);
  // PerspectiveCamera를 React JSX(`<perspectiveCamera>`)로 마운트하면 R3F가
  // 카메라를 scene 자식이 아닌 별도 처리할 수 있어 group의 worldMatrix가
  // 카메라에 제대로 상속되지 않는 케이스가 있다. 직접 인스턴스를 만들어
  // useEffect에서 group에 add하면 일반 Object3D처럼 부모 transform을
  // 100% 상속받는다. useState lazy init으로 한 번만 생성.
  const [perspectiveCamera] = useState(() => new PerspectiveCamera());
  const scene = useThree((state) => state.scene);

  const frustumSegmentsX = sensor.frustumSegmentsX;
  const frustumSegmentsY = sensor.frustumSegmentsY;

  // 기하 객체는 state로 관리. useMemo로 만들면 useFrame 안에서 mutation이
  // react-hooks/immutability 린트에 걸린다. state는 set 시점에만 참조가 바뀌고
  // 그 외에는 자유롭게 mutate 가능 — 매 frame attribute.array를 갱신해도 OK.
  const [geometries, setGeometries] = useState<{
    frustum: BufferGeometry;
    line: BufferGeometry;
    segments: FrustumLineSegment[];
  } | null>(null);

  // segment 수가 바뀌면 geometry를 재생성.
  useEffect(() => {
    const frustum = createFrustumGeometry(frustumSegmentsX, frustumSegmentsY);
    const segments = createFrustumGridSegments(
      frustumSegmentsX,
      frustumSegmentsY,
    );
    const line = createFrustumLineGeometry(segments.length);
    setGeometries({ frustum, line, segments });
    return () => {
      frustum.dispose();
      line.dispose();
    };
  }, [frustumSegmentsX, frustumSegmentsY]);

  const raycasterRef = useRef(new Raycaster());
  const cameraWorldPositionRef = useRef(new Vector3());
  const ndcPointRef = useRef(new Vector3());
  const directionRef = useRef(new Vector3());
  const localNearRef = useRef(new Vector3());
  const localFarRef = useRef(new Vector3());

  // 모델/텍스트와 동일하게 group을 modelObjectRegistry에 등록한다.
  // 동시에 PerspectiveCamera 인스턴스를 group의 자식으로 add 한다.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const camera = perspectiveCamera;
    group.add(camera);
    modelObjectRegistry.register(sensor.id, group);
    return () => {
      modelObjectRegistry.unregister(sensor.id, group);
      group.remove(camera);
    };
  }, [sensor.id]);

  useEffect(() => {
    (raycasterRef.current as Raycaster & { firstHitOnly?: boolean }).firstHitOnly =
      CAMERA_FRUSTUM_RAYCAST_FIRST_HIT_ONLY;
  }, []);

  // 초기 projection을 동기적으로 한 번 보정 (첫 frame 전).
  // 이후 매 frame에도 syncCameraProjection을 호출해 FOV/near/far 변경을 반영.
  syncCameraProjection(perspectiveCamera, sensor);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect?.(sensor.id);
    },
    [sensor.id, onSelect],
  );

  useFrame(() => {
    const camera = perspectiveCamera;
    const group = groupRef.current;
    if (!camera || !group) return;
    if (!geometries) return;
    const frustum = geometries.frustum;
    const line = geometries.line;
    const segments = geometries.segments;

    const { meshes: occluderMeshes } = getSceneOccluders(scene);

    // 매 frame 재계산한다. 이전에는 dirty-check로 sensor 파라미터와 occluder
    // revision만 비교했는데, 그러면 모델이 TransformControls로 움직여도
    // occluder의 worldMatrix 변화를 감지 못해 frustum이 stale 상태로 남고,
    // 첫 배치 시에도 occluder 등록 타이밍과 맞물려 절대 갱신되지 않는 경쟁
    // 조건이 있었다. BVH 가속이 있어 매 frame 수십~수백 ray 계산은 가볍다.

    // projection이 stale 하지 않도록 매번 동기화.
    syncCameraProjection(camera, sensor);
    group.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const cameraWorldPosition = cameraWorldPositionRef.current;
    const ndcPoint = ndcPointRef.current;
    const direction = directionRef.current;
    const localNear = localNearRef.current;
    const localFar = localFarRef.current;
    const frustumPositions = frustum.attributes.position.array as Float32Array;
    const gridCount = (frustumSegmentsX + 1) * (frustumSegmentsY + 1);

    camera.getWorldPosition(cameraWorldPosition);
    let nearWriteIndex = 0;
    let farWriteIndex = gridCount * 3;

    for (let j = 0; j <= frustumSegmentsY; j += 1) {
      const v = j / frustumSegmentsY;
      const yNdc = 1 - v * 2;
      for (let i = 0; i <= frustumSegmentsX; i += 1) {
        const u = i / frustumSegmentsX;
        const xNdc = u * 2 - 1;

        ndcPoint.set(xNdc, yNdc, 1).unproject(camera);
        direction.copy(ndcPoint).sub(cameraWorldPosition).normalize();

        raycasterRef.current.set(cameraWorldPosition, direction);
        raycasterRef.current.far = sensor.far;
        const hits: { distance: number; object: Object3D }[] =
          raycasterRef.current.intersectObjects(occluderMeshes, false);
        // hit이 near plane보다 가까우면 무시 — 그 ray는 카메라가 지면에
        // 박혀 있거나 아주 가까운 mesh에 때려 frustum 모서리가 0 두께로
        // 붕괴하는 걸 방지한다.
        const firstHit = hits.length > 0 ? hits[0].distance : Infinity;
        const hitDistance =
          firstHit > sensor.near && firstHit < sensor.far
            ? firstHit
            : sensor.far;

        localNear
          .copy(cameraWorldPosition)
          .addScaledVector(direction, sensor.near);
        localFar
          .copy(cameraWorldPosition)
          .addScaledVector(direction, hitDistance);

        // frustum mesh는 group의 자식으로 마운트되므로 group local space로 변환.
        // (카메라 자체가 group과 동일 transform이라 결과는 같지만 frustum의
        // 부모가 group이기 때문에 group 기준이 더 명확하고 안전.)
        group.worldToLocal(localNear);
        group.worldToLocal(localFar);

        frustumPositions[nearWriteIndex] = localNear.x;
        frustumPositions[nearWriteIndex + 1] = localNear.y;
        frustumPositions[nearWriteIndex + 2] = localNear.z;
        nearWriteIndex += 3;
        frustumPositions[farWriteIndex] = localFar.x;
        frustumPositions[farWriteIndex + 1] = localFar.y;
        frustumPositions[farWriteIndex + 2] = localFar.z;
        farWriteIndex += 3;
      }
    }
    frustum.attributes.position.needsUpdate = true;

    // Update wireframe line segments
    const linePositions = line.attributes.position.array as Float32Array;
    let lineWriteIndex = 0;
    segments.forEach(([fromIndex, toIndex]) => {
      const fromOffset = fromIndex * 3;
      const toOffset = toIndex * 3;
      linePositions[lineWriteIndex] = frustumPositions[fromOffset];
      linePositions[lineWriteIndex + 1] = frustumPositions[fromOffset + 1];
      linePositions[lineWriteIndex + 2] = frustumPositions[fromOffset + 2];
      lineWriteIndex += 3;
      linePositions[lineWriteIndex] = frustumPositions[toOffset];
      linePositions[lineWriteIndex + 1] = frustumPositions[toOffset + 1];
      linePositions[lineWriteIndex + 2] = frustumPositions[toOffset + 2];
      lineWriteIndex += 3;
    });
    line.attributes.position.needsUpdate = true;
  });

  return (
    <group
      ref={groupRef}
      name={sensor.id}
      position={sensor.position}
      rotation={[degToRad(sensor.rotation[0]), degToRad(sensor.rotation[1]), degToRad(sensor.rotation[2])]}
    >
      <mesh onClick={handleClick}>
        <boxGeometry args={CAMERA_BODY_SIZE} />
        <meshStandardMaterial
          color={isSelected ? '#facc15' : CAMERA_BODY_COLOR}
        />
      </mesh>
      <mesh position={[0, 0, LENS_OFFSET_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[LENS_RADIUS, LENS_RADIUS, LENS_LENGTH, LENS_SEGMENTS]}
        />
        <meshStandardMaterial color={LENS_COLOR} />
      </mesh>
      {geometries ? (
        <>
          <mesh geometry={geometries.frustum}>
            <meshBasicMaterial
              color={FRUSTUM_COLOR}
              transparent
              opacity={FRUSTUM_OPACITY}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={geometries.line}>
            <lineBasicMaterial
              color={FRUSTUM_COLOR}
              transparent
              opacity={FRUSTUM_GRID_OPACITY}
            />
          </lineSegments>
        </>
      ) : null}
    </group>
  );
}
