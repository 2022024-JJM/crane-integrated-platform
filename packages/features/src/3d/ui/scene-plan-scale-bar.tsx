import { useImperativeHandle, useRef, type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useFrame } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { cn } from '@crane/core/lib/utils';
import {
  orthoPixelsPerUnit,
  resolvePlanScaleBar,
  type PlanScaleBar,
} from '../lib/plan-scale-bar';

export interface ScenePlanScaleBarHandle {
  /** 드라이버가 축척이 바뀐 프레임에만 부른다. null 이면 숨긴다. */
  update: (bar: PlanScaleBar | null) => void;
}

/**
 * 평면도 축척 바(DOM 오버레이) — 흰 선 양 끝 눈금 + 길이 문구. 직교 탑뷰에서만
 * 보이고 원근에서는 숨는다(원근은 화면 위치마다 축척이 달라 바 하나가 거짓이다).
 * 값은 React 상태가 아니다 — Canvas 안 ScenePlanScaleBarDriver 가 useFrame 에서
 * `update` 로 DOM 을 직접 쓴다(나침반과 같은 규칙). 위치는 부모가 정한다.
 */
export function ScenePlanScaleBar({
  ref,
  className,
}: {
  ref: Ref<ScenePlanScaleBarHandle>;
  className?: string;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      update(bar) {
        const root = rootRef.current;
        const line = barRef.current;
        const label = labelRef.current;
        if (!root || !line || !label) return;
        if (!bar) {
          root.style.display = 'none';
          return;
        }
        line.style.width = `${bar.px}px`;
        label.textContent = bar.label;
        root.style.display = '';
      },
    }),
    [],
  );

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={t('monitoring:planScale.label')}
      style={{ display: 'none' }}
      className={cn(
        'pointer-events-none flex flex-col items-start gap-0.5 text-[11px] leading-none font-semibold text-white drop-shadow',
        className,
      )}
    >
      <span ref={labelRef} className="px-0.5 tabular-nums" />
      <div ref={barRef} className="h-1.5 border-x-2 border-b-2 border-white" />
    </div>
  );
}

interface ScaleBarFrameState {
  handle: ScenePlanScaleBarHandle | null;
  meters: number;
  px: number;
}

/**
 * 축척 갱신(Canvas 안) — 활성 카메라가 직교면 zoom·프러스텀·캔버스 높이로
 * m 당 px 를 구해 바뀐 프레임에만 `update` 를 부른다. 원근이면 한 번 null 을
 * 써 숨긴다. frameloop demand 라 카메라가 멈춰 있으면 비용이 없다.
 * `metersPerUnit` 은 씬 단위 스케일(getSceneMetersPerUnit).
 */
export function ScenePlanScaleBarDriver({
  barRef,
  metersPerUnit,
}: {
  barRef: RefObject<ScenePlanScaleBarHandle | null>;
  metersPerUnit: number;
}) {
  const frameRef = useRef<ScaleBarFrameState>({
    handle: null,
    meters: Number.NaN,
    px: Number.NaN,
  });

  useFrame(({ camera, size }) => {
    const handle = barRef.current;
    if (!handle) return;
    const frame = frameRef.current;
    const ortho = camera as OrthographicCamera;
    let bar: PlanScaleBar | null = null;
    if (ortho.isOrthographicCamera === true) {
      const pxPerUnit = orthoPixelsPerUnit(
        ortho.zoom,
        ortho.top,
        ortho.bottom,
        size.height,
      );
      bar = resolvePlanScaleBar(pxPerUnit / metersPerUnit);
    }
    const meters = bar ? bar.meters : Number.NaN;
    const px = bar ? bar.px : Number.NaN;
    if (
      frame.handle === handle &&
      Object.is(frame.meters, meters) &&
      Object.is(frame.px, px)
    ) {
      return;
    }
    frame.handle = handle;
    frame.meters = meters;
    frame.px = px;
    handle.update(bar);
  });

  return null;
}
