import { Text } from '@react-three/drei';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { degToRad } from '../lib/math-utils';

interface SceneTextProps {
  id: string;
  content: string;
  color: string;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onObjectReady?: (id: string, object: Group | null) => void;
}

function TextSelectionOutline({ width, height }: { width: number; height: number }) {
  const hw = width / 2 + 0.3;
  const hh = height / 2 + 0.3;

  const positions = new Float32Array([
    -hw, -hh, 0,
    hw, -hh, 0,
    hw, hh, 0,
    -hw, hh, 0,
    -hw, -hh, 0,
  ]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ffff00" depthTest={false} />
    </line>
  );
}

export const SceneText = memo(function SceneText({
  id,
  content,
  color,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  isSelected = false,
  onSelect,
  onObjectReady,
}: SceneTextProps) {
  const groupRef = useRef<Group>(null);
  const [textSize, setTextSize] = useState<{ width: number; height: number }>({
    width: 2,
    height: 1,
  });

  useEffect(() => {
    onObjectReady?.(id, groupRef.current);
    return () => {
      onObjectReady?.(id, null);
    };
  }, [id, onObjectReady]);

  const handleClick = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect?.(id);
    },
    [id, onSelect],
  );

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[degToRad(rotation[0]), degToRad(rotation[1]), degToRad(rotation[2])]}
      scale={scale}
    >
      <Text
        fontSize={2}
        color={color}
        anchorX="center"
        anchorY="middle"
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
        }}
        onSync={(troika) => {
          const info = troika.textRenderInfo;
          if (info) {
            const w = info.blockBounds[2] - info.blockBounds[0];
            const h = info.blockBounds[3] - info.blockBounds[1];
            setTextSize((prev) =>
              prev.width === w && prev.height === h ? prev : { width: w, height: h },
            );
          }
        }}
      >
        {content || ' '}
      </Text>
      {isSelected ? (
        <TextSelectionOutline width={textSize.width} height={textSize.height} />
      ) : null}
    </group>
  );
});
