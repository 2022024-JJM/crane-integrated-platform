import { Html } from '@react-three/drei';
import { StableLine } from '@crane/domain/3d';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  PROXIMITY_LINE_COLORS,
  formatProximityGap,
  type ProximityPair,
} from '../lib/scene-proximity';
import { useSceneProximityStore } from '../model/use-scene-proximity-store';

/**
 * 근접 거리 선 — 가까운 모델 쌍의 AABB 최근접점을 잇는 선과 가운데의 미터
 * 라벨. 황색(주의)·적색(위험). 쌍 목록은 스토어가 표시가 바뀔 때만 갱신하므로
 * 여기는 보통 분당 몇 번 리렌더된다. 라벨은 쌍 수가 작아(PROXIMITY_MAX_PAIRS)
 * drei Html 로 둔다.
 */
function midpoint(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1.5, (a[2] + b[2]) / 2];
}

function ProximityLine({ pair }: { pair: ProximityPair }) {
  const { t } = useTranslation();
  const color = PROXIMITY_LINE_COLORS[pair.level];
  const points = useMemo<[Vector3Tuple, Vector3Tuple]>(
    () => [pair.from, pair.to],
    [pair.from, pair.to],
  );
  const mid = useMemo(() => midpoint(pair.from, pair.to), [pair.from, pair.to]);
  return (
    <group>
      <StableLine
        points={points}
        color={color}
        lineWidth={pair.level === 'danger' ? 4 : 2.5}
        depthTest={false}
        renderOrder={20}
      />
      <Html center position={mid} zIndexRange={[6, 5]}>
        <div
          className="pointer-events-none rounded px-1.5 py-0.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-black"
          style={{ background: color, boxShadow: '0 0 0 1px rgba(0,0,0,.5)' }}
        >
          {formatProximityGap(
            pair.gapM,
            t('monitoring:proximity.overlap', { defaultValue: '겹침' }),
          )}
        </div>
      </Html>
    </group>
  );
}

/**
 * 선은 쌍 키가 아니라 **자리(index)** 로 keyed — 쌍 집합이 바뀔 때 선이
 * 리마운트되면 LineMaterial 이 새로 생겨 셰이더가 다시 링크된다. 자리를
 * 재사용하면 points·color 유니폼만 바뀐다. 선 자체는 StableLine(drei Line 의
 * material dispose 버그 회피).
 */
export function SceneProximityLayer() {
  const pairs = useSceneProximityStore((s) => s.pairs);
  if (pairs.length === 0) return null;
  return (
    <>
      {pairs.map((pair, i) => (
        <ProximityLine key={i} pair={pair} />
      ))}
    </>
  );
}
