import { useCallback, useEffect, useRef } from 'react';
import { type Group } from 'three';
import { type ThreeEvent } from '@react-three/fiber';
import { modelObjectRegistry } from '../lib/model-object-registry';
import { degToRad } from '../lib/math-utils';
import type { SavedCameraSensorInfo } from '../model/sensor-types';

const CAMERA_BODY_SIZE: [number, number, number] = [0.45, 0.3, 0.3];
const LENS_RADIUS = 0.07;
const LENS_LENGTH = 0.15;
const LENS_SEGMENTS = 24;
const LENS_OFFSET_Z = -0.22;

const CAMERA_BODY_COLOR = '#dddddd';
const LENS_COLOR = '#333333';

interface CameraSensorMeshProps {
  sensor: SavedCameraSensorInfo;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isMonitoringMode?: boolean;
}

export function CameraSensorMesh({
  sensor,
  isSelected = false,
  onSelect,
}: CameraSensorMeshProps) {
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
    </group>
  );
}
