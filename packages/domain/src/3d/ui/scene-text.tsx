import { Line, Text } from '@react-three/drei';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { degToRad } from '../lib/math-utils';
import { modelObjectRegistry } from '../lib/model-object-registry';
import {
  SELECTION_LINE_COLOR,
  SELECTION_LINE_WIDTH,
} from '../lib/selection-style';

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

const noRaycast = () => null;

function TextSelectionOutline({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  // drei <Line>은 points 참조가 바뀌면 geometry를 다시 만들므로 memo.
  const points = useMemo<Vector3Tuple[]>(() => {
    const hw = width / 2 + 0.3;
    const hh = height / 2 + 0.3;
    return [
      [-hw, -hh, 0],
      [hw, -hh, 0],
      [hw, hh, 0],
      [-hw, hh, 0],
      [-hw, -hh, 0],
    ];
  }, [width, height]);

  return (
    <Line
      points={points}
      color={SELECTION_LINE_COLOR}
      lineWidth={SELECTION_LINE_WIDTH}
      depthTest={false}
      raycast={noRaycast}
    />
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
    const group = groupRef.current;
    if (group) {
      modelObjectRegistry.register(id, group);
    }
    onObjectReady?.(id, group);
    return () => {
      if (group) {
        modelObjectRegistry.unregister(id, group);
      }
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
      rotation={[
        degToRad(rotation[0]),
        degToRad(rotation[1]),
        degToRad(rotation[2]),
      ]}
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
              prev.width === w && prev.height === h
                ? prev
                : { width: w, height: h },
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
