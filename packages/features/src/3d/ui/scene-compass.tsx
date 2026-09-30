import {
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import { cn } from '@crane/core/lib/utils';
import {
  COMPASS_NEEDLE_NORTH_POINTS,
  COMPASS_NEEDLE_SOUTH_POINTS,
  COMPASS_POINTS,
  COMPASS_RING_RADIUS_PX,
  COMPASS_SIZE_PX,
  COMPASS_VIEW_BOX,
  compassLabelPosition,
  compassPlaneMatrix,
  resolveCompassView,
  type CompassView,
} from '../lib/compass';

export interface SceneCompassHandle {
  /** 드라이버가 자세가 바뀐 프레임에만 부른다. 첫 호출 전엔 숨어 있다. */
  update: (view: CompassView) => void;
}

/**
 * 방위 표시(DOM 오버레이) — 지면에 놓인 원 + 네 방위 글자 + 바늘. 모양은
 * ACMS 매뉴얼의 방위 표시(가는 흰 원, N·E·S·W)에 바늘(북 적색)을 더했다.
 * 원과 바늘은 카메라 기울기만큼 눕고, 글자는 타원 위 자리만 따라가며 서 있다.
 *
 * 자세는 React 상태가 아니다 — Canvas 안 SceneCompassDriver 가 useFrame 에서
 * `update` 로 SVG 속성을 직접 쓴다(미니맵과 같은 매-프레임 갱신 규칙).
 * 여기 JSX 는 자세와 무관한 속성만 두어 리렌더가 직접 쓴 값을 덮지 않는다.
 * 첫 `update` 전에는 visibility hidden — 카메라와 어긋난 방위를 보이지 않는다.
 * 위치(absolute)는 부모가 정한다. 조작은 없다(pointer-events-none).
 */
export function SceneCompass({
  ref,
  className,
}: {
  ref: Ref<SceneCompassHandle>;
  className?: string;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<SVGSVGElement | null>(null);
  const planeRef = useRef<SVGGElement | null>(null);
  const labelsRef = useRef<SVGGElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      update(view) {
        const root = rootRef.current;
        const plane = planeRef.current;
        const labels = labelsRef.current;
        if (!root || !plane || !labels) return;
        const [a, b, c, d] = compassPlaneMatrix(view);
        plane.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} 0 0)`);
        COMPASS_POINTS.forEach((point, index) => {
          const label = labels.children[index];
          if (!label) return;
          const { x, y } = compassLabelPosition(view, point.bearing);
          label.setAttribute('x', String(x));
          label.setAttribute('y', String(y));
        });
        root.style.visibility = 'visible';
      },
    }),
    [],
  );

  return (
    <svg
      ref={rootRef}
      role="img"
      aria-label={t('monitoring:compass.label')}
      width={COMPASS_SIZE_PX}
      height={COMPASS_SIZE_PX}
      viewBox={COMPASS_VIEW_BOX}
      style={{ visibility: 'hidden' }}
      className={cn('pointer-events-none shrink-0 drop-shadow', className)}
    >
      <g ref={planeRef}>
        <circle
          r={COMPASS_RING_RADIUS_PX}
          fill="none"
          className="stroke-white"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={COMPASS_NEEDLE_NORTH_POINTS}
          className="fill-red-500"
        />
        <polygon points={COMPASS_NEEDLE_SOUTH_POINTS} className="fill-white" />
      </g>
      <g ref={labelsRef} className="fill-white text-[11px] font-semibold">
        {COMPASS_POINTS.map((point) => (
          <text
            key={point.label}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {point.label}
          </text>
        ))}
      </g>
    </svg>
  );
}

interface CompassFrameState {
  quaternion: Quaternion;
  forward: Vector3;
  up: Vector3;
  /** 마지막으로 쓴 대상·자세 — 같으면 DOM 을 건드리지 않는다. */
  handle: SceneCompassHandle | null;
  northDeg: number;
  tilt: number;
}

function createCompassFrameState(): CompassFrameState {
  return {
    quaternion: new Quaternion(),
    forward: new Vector3(),
    up: new Vector3(),
    handle: null,
    northDeg: Number.NaN,
    tilt: Number.NaN,
  };
}

/**
 * 나침반 자세 갱신(Canvas 안) — 카메라 월드 자세 + 씬 진북으로 자세를 구해
 * 바뀐 프레임에만 `compassRef.current.update` 를 부른다. frameloop demand 라
 * 카메라가 멈춰 있으면 비용이 없다. 카메라가 확정된 뒤(SceneCameraLimits
 * 다음) 마운트해 그 프레임의 최종 시점을 읽는다. 진북이 바뀌면 프레임을 한 번
 * 요청한다(에디터가 아닌 화면에선 씬 로드 때뿐).
 */
export function SceneCompassDriver({
  compassRef,
  trueNorth,
}: {
  compassRef: RefObject<SceneCompassHandle | null>;
  /** 씬 진북(월드 방위, 도 — resolveTrueNorth). */
  trueNorth: number;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const frameRef = useRef<CompassFrameState>(createCompassFrameState());

  useEffect(() => {
    invalidate();
  }, [trueNorth, invalidate]);

  useFrame(({ camera }) => {
    const handle = compassRef.current;
    if (!handle) return;
    const frame = frameRef.current;
    camera.getWorldQuaternion(frame.quaternion);
    frame.forward.set(0, 0, -1).applyQuaternion(frame.quaternion);
    frame.up.set(0, 1, 0).applyQuaternion(frame.quaternion);
    const view = resolveCompassView(frame.forward, frame.up, trueNorth);
    if (!view) return;
    if (
      frame.handle === handle &&
      frame.northDeg === view.northDeg &&
      frame.tilt === view.tilt
    ) {
      return;
    }
    frame.handle = handle;
    frame.northDeg = view.northDeg;
    frame.tilt = view.tilt;
    handle.update(view);
  });

  return null;
}
