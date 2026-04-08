import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Euler,
  type Group,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import '../lib/bvh-setup';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { getSceneOccluders } from '../lib/scene-occluder-registry';
import { degToRad } from '../lib/math-utils';
import type { SavedLidarSensorInfo } from '../model/sensor-types';

// sensor simulation2의 LidarMesh를 도메인으로 옮긴 버전.
// 핵심 차이: store 직접 구독 대신 props로 sceneObject + onSelect를 받는다.
// 메인 프로젝트의 모델/텍스트 컴포넌트와 동일한 패턴.

const LIDAR_RAYCAST_FIRST_HIT_ONLY = true;

const LIDAR_BODY_RADIUS = 0.15;
const LIDAR_BODY_HEIGHT = 0.14;
const LIDAR_BODY_SEGMENTS = 24;
const LIDAR_TOP_RADIUS = 0.08;
const LIDAR_TOP_HEIGHT = 0.08;
const LIDAR_TOP_OFFSET_Y = 0.11;

const LIDAR_BODY_COLOR = '#e2e8f0';
const LIDAR_TOP_COLOR = '#1e293b';
const LIDAR_FOV_COLOR = '#f97316';
const LIDAR_FOV_OPACITY = 0.82;
const FULL_ROTATION_DEGREES = 360;
const FORWARD_DIRECTION = new Vector3(0, 0, -1);

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
function isWrappedFov(value: number) {
  return value >= FULL_ROTATION_DEGREES;
}
function getAngleSampleCount(segmentCount: number, wrapped: boolean) {
  return wrapped ? segmentCount : segmentCount + 1;
}

function createLidarPointGeometry(pointCount: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(pointCount * 3), 3).setUsage(
      DynamicDrawUsage,
    ),
  );
  return geometry;
}

interface LidarSensorMeshProps {
  sensor: SavedLidarSensorInfo;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function LidarSensorMesh({
  sensor,
  isSelected = false,
  onSelect,
}: LidarSensorMeshProps) {
  const groupRef = useRef<Group>(null);
  const raycasterRef = useRef(new Raycaster());
  const scene = useThree((state) => state.scene);

  const localDirectionRef = useRef(new Vector3());
  const worldDirectionRef = useRef(new Vector3());
  const worldPositionRef = useRef(new Vector3());
  const worldQuaternionRef = useRef(new Quaternion());
  const sensorEulerRef = useRef(new Euler(0, 0, 0, 'YXZ'));
  const pointGeometryRef = useRef<BufferGeometry | null>(null);
  const pointPositionsRef = useRef<Float32Array>(new Float32Array());

  const horizontalWrapped = isWrappedFov(sensor.horizontalFov);
  const verticalWrapped = isWrappedFov(sensor.verticalFov);
  const horizontalSampleCount = getAngleSampleCount(
    sensor.horizontalSegments,
    horizontalWrapped,
  );
  const verticalSampleCount = getAngleSampleCount(
    sensor.verticalSegments,
    verticalWrapped,
  );
  const pointCount = horizontalSampleCount * verticalSampleCount;

  const pointGeometry = useMemo(
    () => createLidarPointGeometry(pointCount),
    [pointCount],
  );

  useEffect(() => {
    pointGeometryRef.current = pointGeometry;
    pointPositionsRef.current = pointGeometry.attributes.position
      .array as Float32Array;
    return () => {
      pointGeometry.dispose();
    };
  }, [pointGeometry]);

  // 모델/텍스트와 동일하게 group을 modelObjectRegistry에 등록한다.
  // useSceneTransform이 이 객체를 lookup해 TransformControls를 부착할 수 있게.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    modelObjectRegistry.register(sensor.id, group);
    return () => {
      modelObjectRegistry.unregister(sensor.id, group);
    };
  }, [sensor.id]);

  useEffect(() => {
    // three-mesh-bvh extension. type 정의에 firstHitOnly 가 없을 수 있어 cast.
    (raycasterRef.current as Raycaster & { firstHitOnly?: boolean }).firstHitOnly =
      LIDAR_RAYCAST_FIRST_HIT_ONLY;
  }, []);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect?.(sensor.id);
    },
    [sensor.id, onSelect],
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const { meshes: occluderMeshes } = getSceneOccluders(scene);
    // 매 frame 재계산. dirty-check는 occluder worldMatrix 변화를 감지하지
    // 못해 모델 이동 시 point cloud가 stale이 되므로 제거. BVH 가속이 있어
    // 수백 ray raycast도 가볍다.

    group.updateMatrixWorld(true);
    group.getWorldPosition(worldPositionRef.current);
    group.getWorldQuaternion(worldQuaternionRef.current);

    const geometry = pointGeometryRef.current;
    if (!geometry) return;
    const positions = pointPositionsRef.current;
    const horizontalDenominator = Math.max(1, sensor.horizontalSegments);
    const verticalDenominator = Math.max(1, sensor.verticalSegments);
    const horizontalSweep = degreesToRadians(sensor.horizontalFov);
    const verticalSweep = degreesToRadians(sensor.verticalFov);

    let writeIndex = 0;
    for (let vi = 0; vi < verticalSampleCount; vi += 1) {
      const verticalRatio = vi / verticalDenominator;
      const pitch = (0.5 - verticalRatio) * verticalSweep;

      for (let hi = 0; hi < horizontalSampleCount; hi += 1) {
        const horizontalRatio = hi / horizontalDenominator;
        const yaw = (horizontalRatio - 0.5) * horizontalSweep;

        const localDirection = localDirectionRef.current
          .copy(FORWARD_DIRECTION)
          .applyEuler(sensorEulerRef.current.set(pitch, yaw, 0))
          .normalize();
        const worldDirection = worldDirectionRef.current
          .copy(localDirection)
          .applyQuaternion(worldQuaternionRef.current)
          .normalize();

        raycasterRef.current.set(worldPositionRef.current, worldDirection);
        raycasterRef.current.far = sensor.far;
        const hits = raycasterRef.current.intersectObjects(
          occluderMeshes,
          false,
        );
        const distance = hits.length > 0 ? hits[0].distance : sensor.far;

        positions[writeIndex] = localDirection.x * distance;
        positions[writeIndex + 1] = localDirection.y * distance;
        positions[writeIndex + 2] = localDirection.z * distance;
        writeIndex += 3;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <group
      ref={groupRef}
      name={sensor.id}
      position={sensor.position}
      rotation={[degToRad(sensor.rotation[0]), degToRad(sensor.rotation[1]), degToRad(sensor.rotation[2])]}
    >
      <mesh onClick={handleClick}>
        <cylinderGeometry
          args={[
            LIDAR_BODY_RADIUS,
            LIDAR_BODY_RADIUS,
            LIDAR_BODY_HEIGHT,
            LIDAR_BODY_SEGMENTS,
          ]}
        />
        <meshStandardMaterial
          color={isSelected ? '#facc15' : LIDAR_BODY_COLOR}
        />
      </mesh>
      <mesh position={[0, LIDAR_TOP_OFFSET_Y, 0]} onClick={handleClick}>
        <cylinderGeometry
          args={[
            LIDAR_TOP_RADIUS,
            LIDAR_TOP_RADIUS,
            LIDAR_TOP_HEIGHT,
            LIDAR_BODY_SEGMENTS,
          ]}
        />
        <meshStandardMaterial color={LIDAR_TOP_COLOR} />
      </mesh>
      <points geometry={pointGeometry}>
        <pointsMaterial
          color={LIDAR_FOV_COLOR}
          size={sensor.pointSize}
          sizeAttenuation
          transparent
          opacity={LIDAR_FOV_OPACITY}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
