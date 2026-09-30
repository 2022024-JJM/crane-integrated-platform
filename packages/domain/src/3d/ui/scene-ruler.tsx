import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  Vector3,
  type Camera,
  type Group,
  type OrthographicCamera,
  type PerspectiveCamera,
} from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { isLabelInRange, labelScaleAtDistance } from '../lib/label-scale';
import { degToRad } from '../lib/math-utils';
import { modelObjectRegistry } from '../lib/model-object-registry';
import {
  formatRulerValue,
  isRulerLabelVisible,
  pixelsPerUnitAtDistance,
  resolveRulerInterval,
  rulerAxisPoints,
  rulerDotCenterPx,
  rulerDotSizePx,
  rulerGuidePoints,
  rulerLabelMinSpacingPx,
  rulerLabelStride,
  rulerTextSizePx,
  rulerTicks,
  RULER_LINE_LIFT_M,
  type RulerViewScale,
} from '../lib/ruler';
import {
  SELECTION_LINE_COLOR,
  SELECTION_LINE_WIDTH,
} from '../lib/selection-style';
import {
  RULER_GUIDE_OPACITY_DEFAULT,
  type SavedRulerGuide,
  type SceneRulerSize,
} from '../model/ruler-types';
import { PerViewport } from './scene-viewports';

/**
 * 거리 눈금 — 에디터·모니터링(3D 플레이 포함) 공용.
 *
 * - 눈금 자리의 점과 그 아래 화면을 향한 숫자는 ACMS 매뉴얼 그림 그대로다.
 *   둘 다 DOM(drei Html)이라 바닥에 메시를 깔지 않는다 — 바닥과 겹쳐 깜빡일
 *   것이 없다. 글자에 그림자·테두리는 두지 않는다. 크기는 점·글자 각각
 *   세 단계이고 픽셀 값은 lib/ruler.ts 다.
 * - 점과 숫자는 **모델 라벨과 같은 거리 규칙**(lib/label-scale.ts)으로 멀어질
 *   수록 줄고 같은 거리에서 사라진다. 축소의 기준점은 점의 중심이라 줄어도
 *   점이 눈금 자리를 벗어나지 않는다.
 * - 보조선은 점에서 한쪽으로 뻗는 선이다. 화면 픽셀 두께 선(drei Line)을
 *   바닥에서 RULER_LINE_LIFT_M 띄우고 깊이 테스트를 켠다 — 로그 깊이에서는
 *   polygonOffset 이 무시되므로 물리적으로 띄운다. renderOrder 1 은 바다(0.25)
 *   위 오버레이 규칙(≥ 0.5)이다.
 * - 안쪽 그룹의 scale 이 1/metersPerUnit 이라 그 아래 좌표는 전부 m 다. 바깥
 *   그룹(기즈모 대상·레지스트리 등록)은 scale 1 로 둔다.
 * - 숫자는 눈금마다 카메라 거리로 화면 간격을 구해 촘촘하면 건너뛴다. 매
 *   프레임 style 만 고치고 setState 는 없다(model-label 과 같은 방식).
 */

const LINE_WIDTH_PX = 1.5;

const noRaycast = () => null;
const _tickWorld = new Vector3();

/** 점의 중심이 눈금 자리에 오게 옮긴 뒤, 그 점을 기준으로 줄인다. */
function labelTransform(scale: number, dotCenterPx: number): string {
  const translate = `translate(-50%, -${dotCenterPx}px)`;
  return scale === 1 ? translate : `${translate} scale(${scale})`;
}

/**
 * 눈금 하나의 transform 을 쓴다. 배율과 점 중심을 DOM 에 적어 두고 둘 중
 * 하나라도 바뀌었을 때만 고친다 — React 는 transform 을 관리하지 않는다.
 */
function writeLabelTransform(
  element: HTMLDivElement,
  scale: number,
  dotCenterPx: number,
): void {
  const scaleKey = String(scale);
  const centerKey = String(dotCenterPx);
  if (
    element.dataset.scale === scaleKey &&
    element.dataset.center === centerKey
  ) {
    return;
  }
  element.style.transform = labelTransform(scale, dotCenterPx);
  element.dataset.scale = scaleKey;
  element.dataset.center = centerKey;
}

function resolveViewScale(camera: Camera, heightPx: number): RulerViewScale {
  if ((camera as OrthographicCamera).isOrthographicCamera) {
    const ortho = camera as OrthographicCamera;
    const zoom = ortho.zoom > 0 ? ortho.zoom : 1;
    return {
      orthoHeight: (ortho.top - ortho.bottom) / zoom,
      viewportHeightPx: heightPx,
    };
  }
  return {
    fovDeg: (camera as PerspectiveCamera).fov,
    viewportHeightPx: heightPx,
  };
}

interface RulerBodyProps {
  id: string;
  /** 씬 unit. */
  length: number;
  /** m. */
  interval: number;
  textColor: string;
  dotColor: string;
  /** 숫자·점의 크기. 생략하면 기본(M). */
  textSize?: SceneRulerSize;
  dotSize?: SceneRulerSize;
  /** 보조선. 없으면 점과 숫자만 그린다. */
  guide?: SavedRulerGuide;
  startValue?: number;
  unitHidden?: boolean;
  /** 씬 1 unit 의 m(getSceneMetersPerUnit). 기본 1. */
  metersPerUnit?: number;
  isSelected?: boolean;
  /** 있으면 점·숫자·보조선이 클릭을 받는다(에디터). 없으면 클릭이 통과한다. */
  onSelect?: (id: string) => void;
  /** 끝점 위에 띄우는 문구 — 그리는 중의 현재 길이. */
  endLabel?: string;
}

interface RulerLabelsProps {
  /** 눈금 좌표계의 group(scale 1/metersPerUnit) — 거리 계산의 월드 기준. */
  scaled: Group | null;
  ticks: ReturnType<typeof rulerTicks>;
  shownInterval: number;
  scale: number;
  lengthM: number;
  dotSizePx: number;
  dotCenterPx: number;
  textSizePx: number;
  labelMinSpacingPx: number;
  textColor: string;
  dotColor: string;
  unitHidden: boolean;
  endLabel?: string;
  onSelect?: (id: string) => void;
  onClick: (event: { stopPropagation: () => void }) => void;
  /** 분할 타일의 DOM 컨테이너(drei Html portal). 단일 화면은 없음. */
  portal?: RefObject<HTMLElement | null>;
}

/**
 * 점·숫자(DOM) — 분할 화면에서는 타일마다 복제되므로 선(RulerBody)과 분리돼
 * 있다. useFrame 의 camera·size 는 자기 뷰포트(포털 state)의 것이다.
 */
function RulerLabels({
  scaled,
  ticks,
  shownInterval,
  scale,
  lengthM,
  dotSizePx,
  dotCenterPx,
  textSizePx,
  labelMinSpacingPx,
  textColor,
  dotColor,
  unitHidden,
  endLabel,
  onSelect,
  onClick,
  portal,
}: RulerLabelsProps) {
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);

  useFrame(({ camera, size }) => {
    if (!scaled) return;
    scaled.updateWorldMatrix(true, false);
    const view = resolveViewScale(camera, size.height);
    const intervalUnits = shownInterval / scale;
    for (let i = 0; i < ticks.length; i += 1) {
      const element = labelRefs.current[i];
      if (!element) continue;
      _tickWorld.set(ticks[i].distance, 0, 0).applyMatrix4(scaled.matrixWorld);
      const distance = camera.position.distanceTo(_tickWorld);
      const labelScale = labelScaleAtDistance(distance);
      const pxPerInterval =
        pixelsPerUnitAtDistance(view, distance) * intervalUnits;
      // 줄어든 글자는 그만큼 좁은 간격에서도 겹치지 않는다.
      const visible =
        isLabelInRange(distance) &&
        isRulerLabelVisible(
          ticks[i].index,
          rulerLabelStride(pxPerInterval, labelMinSpacingPx * labelScale),
        );
      // 현재 상태는 DOM 에서 읽는다 — React 는 display·transform 을 관리하지
      // 않으므로 리렌더 뒤에도 직전에 쓴 값이 그대로 남아 있다.
      const shown = element.style.display !== 'none';
      if (visible !== shown) {
        element.style.display = visible ? '' : 'none';
      }
      if (!visible) continue;
      writeLabelTransform(element, labelScale, dotCenterPx);
    }
  });

  return (
    <>
      {ticks.map((tick, i) => (
        <group key={tick.index} position={[tick.distance, 0, 0]}>
          {/* 모델 라벨 [5,0]·영역 배지 [4,0] 아래. */}
          <Html
            zIndexRange={[3, 0]}
            style={{ pointerEvents: 'none' }}
            portal={portal as RefObject<HTMLElement> | undefined}
          >
            <div
              ref={(element) => {
                labelRefs.current[i] = element;
                if (!element) return;
                // 첫 프레임 전에도 점이 눈금 자리에 있게 한다. 배율은
                // useFrame 이 거리로 다시 정한다. 점 크기가 바뀐 렌더에서는
                // 직전 배율 그대로 중심만 고친다 — 캔버스가 demand 라 다음
                // 프레임이 바로 오지 않는다.
                const lastScale = Number(element.dataset.scale);
                writeLabelTransform(
                  element,
                  Number.isFinite(lastScale) && lastScale > 0 ? lastScale : 1,
                  dotCenterPx,
                );
              }}
              className={`flex flex-col items-center gap-0.5 whitespace-nowrap select-none ${onSelect ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
              style={{ transformOrigin: `50% ${dotCenterPx}px` }}
              onPointerDown={
                onSelect
                  ? (event) => {
                      event.stopPropagation();
                    }
                  : undefined
              }
              onClick={onSelect ? onClick : undefined}
            >
              <span
                aria-hidden
                className="block rounded-full"
                style={{
                  width: dotSizePx,
                  height: dotSizePx,
                  backgroundColor: dotColor,
                }}
              />
              <span
                className="font-sans leading-none font-medium tabular-nums"
                style={{ color: textColor, fontSize: textSizePx }}
              >
                {formatRulerValue(tick.value, shownInterval, unitHidden)}
              </span>
            </div>
          </Html>
        </group>
      ))}
      {endLabel ? (
        <group position={[lengthM, 0, 0]}>
          <Html
            zIndexRange={[3, 0]}
            style={{ pointerEvents: 'none' }}
            portal={portal as RefObject<HTMLElement> | undefined}
          >
            <div
              className="rounded-sm bg-black/70 px-1.5 py-0.5 font-sans text-[12px] leading-none font-medium whitespace-nowrap text-white tabular-nums select-none"
              style={{ transform: 'translate(-50%, calc(-100% - 10px))' }}
            >
              {endLabel}
            </div>
          </Html>
        </group>
      ) : null}
    </>
  );
}

function RulerBody({
  id,
  length,
  interval,
  textColor,
  dotColor,
  textSize,
  dotSize,
  guide,
  startValue = 0,
  unitHidden = false,
  metersPerUnit = 1,
  isSelected = false,
  onSelect,
  endLabel,
}: RulerBodyProps) {
  // 점·숫자 포털의 컨테이너로 쓰려고 group 을 상태로 든다(마운트 뒤 한 번).
  const [scaled, setScaled] = useState<Group | null>(null);

  const dotSizePx = rulerDotSizePx(dotSize);
  const dotCenterPx = rulerDotCenterPx(dotSize);
  const textSizePx = rulerTextSizePx(textSize);
  const labelMinSpacingPx = rulerLabelMinSpacingPx(textSize);

  const scale = metersPerUnit > 0 ? metersPerUnit : 1;
  const lengthM = length * scale;
  const guideLengthM = guide ? guide.length * scale : 0;
  const guideSide = guide?.side;

  const ticks = useMemo(
    () => rulerTicks({ lengthM, interval, startValue }),
    [lengthM, interval, startValue],
  );
  const shownInterval = useMemo(
    () => resolveRulerInterval({ lengthM, interval, startValue }),
    [lengthM, interval, startValue],
  );
  // drei <Line> 은 points 참조가 바뀌면 geometry 를 다시 만들므로 memo.
  const guidePoints = useMemo(
    () => rulerGuidePoints(ticks, guideLengthM, guideSide),
    [ticks, guideLengthM, guideSide],
  );
  const axisPoints = useMemo(() => rulerAxisPoints(lengthM), [lengthM]);

  useFrame(() => {
    if (!scaled) return;
    // 눈금에는 크기(scale)가 없다. 다중 선택 크기 드래그가 바깥 그룹을 늘려
    // 놓았으면 되돌린다 — 저장값이 없어 React 가 되돌려 주지 않는다.
    const outer = scaled.parent;
    if (
      outer &&
      (outer.scale.x !== 1 || outer.scale.y !== 1 || outer.scale.z !== 1)
    ) {
      outer.scale.set(1, 1, 1);
    }
  });

  const handleClick = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect?.(id);
    },
    [id, onSelect],
  );

  return (
    <group ref={setScaled} scale={1 / scale}>
      {guide && guidePoints.length > 0 ? (
        <Line
          segments
          points={guidePoints}
          position={[0, RULER_LINE_LIFT_M, 0]}
          color={guide.color}
          lineWidth={LINE_WIDTH_PX}
          transparent
          opacity={guide.opacity ?? RULER_GUIDE_OPACITY_DEFAULT}
          depthWrite={false}
          toneMapped={false}
          renderOrder={1}
          {...(onSelect ? { onClick: handleClick } : { raycast: noRaycast })}
        />
      ) : null}
      {isSelected ? (
        <Line
          points={axisPoints}
          position={[0, RULER_LINE_LIFT_M, 0]}
          color={SELECTION_LINE_COLOR}
          lineWidth={SELECTION_LINE_WIDTH}
          depthTest={false}
          renderOrder={1}
          raycast={noRaycast}
        />
      ) : null}
      {/* 점·숫자 — 분할 화면이면 타일마다 복제(선은 한 번만 그린다). */}
      <PerViewport container={scaled}>
        {(viewport) => (
          <RulerLabels
            scaled={scaled}
            ticks={ticks}
            shownInterval={shownInterval}
            scale={scale}
            lengthM={lengthM}
            dotSizePx={dotSizePx}
            dotCenterPx={dotCenterPx}
            textSizePx={textSizePx}
            labelMinSpacingPx={labelMinSpacingPx}
            textColor={textColor}
            dotColor={dotColor}
            unitHidden={unitHidden}
            endLabel={endLabel}
            onSelect={viewport === null ? onSelect : undefined}
            onClick={handleClick}
            portal={viewport?.portal}
          />
        )}
      </PerViewport>
    </group>
  );
}

interface SceneRulerProps extends RulerBodyProps {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  onObjectReady?: (id: string, object: Group | null) => void;
}

export const SceneRuler = memo(function SceneRuler({
  id,
  position,
  rotation,
  onObjectReady,
  ...body
}: SceneRulerProps) {
  const groupRef = useRef<Group>(null);

  // SceneText 와 같은 ref 패턴 — onObjectReady 를 effect 의존성에 넣으면 선택
  // 변경으로 콜백 참조가 바뀔 때마다 cleanup 이 `(id, null)` 을 쏜다.
  const onObjectReadyRef = useRef(onObjectReady);
  useEffect(() => {
    onObjectReadyRef.current = onObjectReady;
  }, [onObjectReady]);

  useEffect(() => {
    const group = groupRef.current;
    if (group) {
      modelObjectRegistry.register(id, group);
    }
    onObjectReadyRef.current?.(id, group);
    return () => {
      if (group) {
        modelObjectRegistry.unregister(id, group);
      }
      onObjectReadyRef.current?.(id, null);
    };
  }, [id]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[
        degToRad(rotation[0]),
        degToRad(rotation[1]),
        degToRad(rotation[2]),
      ]}
    >
      <RulerBody id={id} {...body} />
    </group>
  );
});

/**
 * 그리는 중의 미리보기 — 레지스트리에 등록하지 않고 클릭도 받지 않는다.
 * 씬 데이터에 없는 객체라 기즈모·선택 대상이 되면 안 된다.
 */
export function SceneRulerPreview({
  position,
  rotation,
  ...body
}: Omit<SceneRulerProps, 'id' | 'onSelect' | 'onObjectReady' | 'isSelected'>) {
  return (
    <group
      position={position}
      rotation={[
        degToRad(rotation[0]),
        degToRad(rotation[1]),
        degToRad(rotation[2]),
      ]}
    >
      <RulerBody id="ruler-preview" isSelected {...body} />
    </group>
  );
}
