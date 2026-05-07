import { useCallback, useEffect, useRef } from 'react';
import { type Group } from 'three';
import { type ThreeEvent } from '@react-three/fiber';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { degToRad } from '../lib/math-utils';
import type { SavedLidarSensorInfo } from '../model/sensor-types';

const LIDAR_BODY_RADIUS = 0.15;
const LIDAR_BODY_HEIGHT = 0.14;
const LIDAR_BODY_SEGMENTS = 24;
const LIDAR_TOP_RADIUS = 0.08;
const LIDAR_TOP_HEIGHT = 0.08;
const LIDAR_TOP_OFFSET_Y = 0.11;

const LIDAR_BODY_COLOR = '#e2e8f0';
const LIDAR_TOP_COLOR = '#1e293b';

interface LidarSensorMeshProps {
  sensor: SavedLidarSensorInfo;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isMonitoringMode?: boolean;
}

export function LidarSensorMesh({
  sensor,
  isSelected = false,
  onSelect,
}: LidarSensorMeshProps) {
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    modelObjectRegistry.register(sensor.id, group);
    return () => {
      modelObjectRegistry.unregister(sensor.id, group);
    };
  }, [sensor.id]);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect?.(sensor.id);
    },
    [sensor.id, onSelect],
  );

  return (
    <group
      ref={groupRef}
      name={sensor.id}
      position={sensor.position}
      rotation={[
        degToRad(sensor.rotation[0]),
        degToRad(sensor.rotation[1]),
        degToRad(sensor.rotation[2]),
      ]}
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
    </group>
  );
}
