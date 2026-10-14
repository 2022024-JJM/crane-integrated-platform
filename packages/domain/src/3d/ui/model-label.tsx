import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import type {
  EquipmentLabelState,
  EquipmentRuntimeStatus,
} from '@crane/core/types/status';
import {
  isBehindCamera,
  labelBoxClass,
  labelToneDotClass,
  labelZIndex,
  LABEL_UNKNOWN_STATE,
  projectToScreen,
  type AlarmHighlightSeverity,
  type ScreenPoint,
} from '../lib/label-dom';
import {
  formatLabelReading,
  LABEL_READING_EMPTY,
  type ModelLabelReading,
  type ModelLabelValueReader,
} from '../lib/label-reading';
import {
  isLabelInRange,
  LABEL_MIN_SCALE,
  LABEL_VISIBILITY_DISTANCE,
  labelScaleAtDistance,
} from '../lib/label-scale';
import { sceneLookSettings } from '../lib/scene-look';
import {
  forwardPointerDownToCanvas,
  forwardWheelToCanvas,
  isOverlayDrag,
} from '../lib/overlay-pointer-forwarding';

/**
 * 모델 라벨 — 캔버스 위 DOM 오버레이. **drei `Html` 을 쓰지 않는다.** Html 은
 * 라벨마다 React 루트를 하나씩 만들어(createRoot) 루트당 이벤트 리스너
 * 약 200개가 붙고(옥포 45대 = 9천 개), 부모가 리렌더될 때마다 그 루트를 다시
 * 렌더하며, 프레임마다 라벨별로 부모 체인 행렬을 다시 갱신했다. 여기서는
 * 라벨 하나가 DOM 요소 하나다: 마운트 때 만들어 컨테이너(분할 타일의
 * `portal` 또는 캔버스 옆)에 붙이고, 내용은 props 가 바뀔 때만 effect 로
 * 고치며, 위치·크기·표시는 useFrame 에서 바뀐 값만 style 에 쓴다. 리스너는
 * 상자 하나에 네 개(휠·포인터 다운·호버·클릭)뿐이다.
 *
 * 거리에 따른 숨김·축소는 lib/label-scale.ts 의 규칙이다(눈금의 점·숫자와
 * 공유). 알람이 활성화된 라벨은 멀리서도 보여야 하므로 숨김·축소 모두 면제.
 * 표시 상태(고장·Bypass)는 크기를 바꾸지 않는다 — 상태는 색과 아이콘으로만
 * 나타낸다. 투영·z-index·클래스 계산은 lib/label-dom.ts.
 */

/** lucide 아이콘(wifi-off·key-round·refresh-cw)의 path — 라벨 DOM 은 React 밖이라 문자열로 그린다. */
const ICON_WIFI_OFF =
  '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>';
const ICON_KEY_ROUND =
  '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>';
const ICON_REFRESH_CW =
  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>';

function iconSvg(paths: string, className: string): string {
  return `<svg aria-hidden="true" class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/**
 * Bypass·Free Swing 아이콘 칩 — 상자 안, 이름 뒤. 흰 바탕이라 어떤 상자 색
 * 위에서도(적색 포함) 붉은 아이콘이 읽힌다. 아이콘 색은 둘 다 ACMS 기호의
 * 붉은색이다.
 */
const LABEL_BADGE_CLASS =
  'inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-white ring-1 ring-black/30';
const LABEL_BADGE_ICON_CLASS = 'size-2.5 text-[#ff152d]';

/**
 * 태그 값 줄 — 상자 위. ACMS 매뉴얼 그림의 GC 원점 거리 그대로 상자 없는
 * 청록색 굵은 숫자다(색은 그림에서 뽑았다). 어두운 그림자는 밝은 지면 위에서
 * 읽히게 하는 용도다.
 */
const READING_TEXT_COLOR = '#51fff6';
const READING_TEXT_SHADOW =
  '0 0 2px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.8)';

const NO_READINGS: readonly ModelLabelReading[] = [];

/** 라벨의 툴팁 문구 — 라벨은 i18n 을 모르므로 호출자가 번역해 넘긴다. */
export interface ModelLabelTitles {
  tone: Record<EquipmentRuntimeStatus, string>;
  bypass: string;
  freeSwing: string;
}

interface ModelLabelProps {
  id: string;
  equipName?: string;
  /**
   * 부모 객체(primitive=clone)의 local 좌표. ModelMesh가 렌더하는
   * <primitive object={clone}>의 자식으로 마운트되므로 부모 transform
   * (TransformControls가 매 frame mutate하는 transform 포함)을 자동 상속받는다.
   * sceneInfo prop이 아니므로 드래그 중에도 정확히 따라간다.
   */
  localAnchor: Vector3Tuple;
  alarmSeverity?: AlarmHighlightSeverity | null;
  /**
   * 표시 상태(features 가 판정해 넘긴다). tone 은 상자 색이고, 알람이 상자를
   * 차지한 동안만 이름 앞 점으로 옮겨 간다. Bypass 는 열쇠, Free Swing 은 회전
   * 아이콘으로 상자 안 이름 뒤에 붙는다. 생략·unknown 이면 기본 색.
   */
  state?: EquipmentLabelState;
  /** 상태·아이콘 툴팁 문구. 없으면 툴팁 없이 그린다. */
  titles?: ModelLabelTitles;
  /**
   * 상자 위에 쌓일 태그 값 목록(lib/label-reading.ts buildLabelReadings).
   * 값은 `readValue` 로 프레임마다 읽어 바뀔 때만 DOM 에 쓴다 — 라벨은 값
   * 버스를 모르므로 읽기 함수는 features 가 넘긴다.
   */
  readings?: readonly ModelLabelReading[];
  readValue?: ModelLabelValueReader;
  /**
   * 흐림 표시. 모니터링 포커스 중 포커스 밖 모델의 라벨 — 모델 본체가
   * 투명해지는 것과 맞춰 라벨도 흐리게 하고 포인터 이벤트를 끊는다(클릭·
   * hover 콜백 미부착). 라벨은 DOM 이라 material 투명도의 영향을 받지 않는다.
   */
  dimmed?: boolean;
  /**
   * 클릭·hover 를 받을지. 분할 화면의 타일 라벨은 false — 타일 전체가 클릭
   * 영역이라 라벨은 표시만 한다(포인터 이벤트도 끊어 타일 클릭이 통과한다).
   */
  interactive?: boolean;
  /**
   * DOM 을 붙일 컨테이너. 분할 화면은 타일 컨테이너를 넘긴다 — 이 요소 기준으로
   * 위치를 쓴다. 없으면 캔버스 옆(캔버스의 부모).
   */
  portal?: RefObject<HTMLElement | null>;
  onSelect?: (id: string, event?: never) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

/** 마운트 때 한 번 만드는 라벨 DOM 묶음. */
interface LabelDom {
  /** 컨테이너에 붙는 바깥 요소 — 위치(translate)·z-index 를 쓴다. */
  root: HTMLDivElement;
  /** 숨김·축소(scale)를 거는 요소. */
  scaler: HTMLDivElement;
  /** 이름 칩 — 포인터를 받는다. */
  box: HTMLDivElement;
  /** 값 줄 컨테이너(상자 위). */
  readings: HTMLDivElement;
  valueSpans: HTMLSpanElement[];
}

function createLabelDom(): LabelDom {
  const root = document.createElement('div');
  root.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;';
  const center = document.createElement('div');
  center.style.cssText =
    'position:absolute;transform:translate3d(-50%,-50%,0);pointer-events:none;';
  const scaler = document.createElement('div');
  scaler.className = 'pointer-events-none relative';
  const box = document.createElement('div');
  const readings = document.createElement('div');
  readings.className =
    'absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 flex-col-reverse items-center gap-0.5';
  scaler.append(box, readings);
  center.append(scaler);
  root.append(center);
  return { root, scaler, box, readings, valueSpans: [] };
}

export function ModelLabel({
  id,
  equipName,
  localAnchor,
  alarmSeverity = null,
  state = LABEL_UNKNOWN_STATE,
  titles,
  readings = NO_READINGS,
  readValue,
  dimmed = false,
  interactive = true,
  portal,
  onSelect,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: ModelLabelProps) {
  const groupRef = useRef<Group>(null);
  const domRef = useRef<LabelDom | null>(null);
  const canvas = useThree((s) => s.gl.domElement);
  const connected = useThree((s) => s.events.connected) as
    | HTMLElement
    | undefined;
  // 프레임마다 쓰는 마지막 값 — 바뀐 것만 style 에 쓴다.
  const lastRef = useRef({
    x: Number.NaN,
    y: Number.NaN,
    z: Number.NaN,
    visible: true,
    scale: 1,
    emphasis: false,
  });
  const worldPos = useRef(new Vector3());
  const screen = useRef<ScreenPoint>({ x: 0, y: 0 });
  // 핸들러는 ref 로 — DOM 리스너는 마운트 때 한 번만 붙인다.
  const handlersRef = useRef({
    onSelect,
    onHoverStart,
    onHoverMove,
    onHoverEnd,
  });
  useEffect(() => {
    handlersRef.current = { onSelect, onHoverStart, onHoverMove, onHoverEnd };
  }, [onSelect, onHoverStart, onHoverMove, onHoverEnd]);
  const readingsRef = useRef({ readings, readValue });
  useEffect(() => {
    readingsRef.current = { readings, readValue };
  }, [readings, readValue]);
  const alarmRef = useRef(alarmSeverity);
  useEffect(() => {
    alarmRef.current = alarmSeverity;
  }, [alarmSeverity]);

  const { tone, bypass, freeSwing } = state;
  const inert = dimmed || !interactive;
  const hasName = Boolean(equipName);

  // 1) DOM 생성·컨테이너 부착·리스너 — 마운트 1회. 컨테이너가 바뀌면(분할
  //    전환) 옮긴다. 리스너는 ref 의 최신 핸들러를 부른다.
  useEffect(() => {
    if (!hasName) return;
    const target = portal?.current ?? connected ?? canvas.parentElement;
    if (!target) return;
    const dom = createLabelDom();
    domRef.current = dom;
    target.appendChild(dom.root);
    // 다시 붙으면(컨테이너 교체) 첫 프레임이 위치를 반드시 쓰도록 마지막 값을 지운다.
    const last = lastRef.current;

    let down: { x: number; y: number } | null = null;
    const onWheel = (event: WheelEvent) => forwardWheelToCanvas(event, canvas);
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
      forwardPointerDownToCanvas(event, canvas);
    };
    const onPointerEnter = (event: PointerEvent) => {
      event.stopPropagation();
      handlersRef.current.onHoverStart?.(id, event.clientX, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      event.stopPropagation();
      handlersRef.current.onHoverMove?.(id, event.clientX, event.clientY);
    };
    const onPointerLeave = (event: PointerEvent) => {
      event.stopPropagation();
      handlersRef.current.onHoverEnd?.(id);
    };
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      const start = down;
      down = null;
      if (
        start &&
        isOverlayDrag(start.x, start.y, event.clientX, event.clientY)
      )
        return;
      handlersRef.current.onSelect?.(id);
    };
    const { box } = dom;
    box.addEventListener('wheel', onWheel, { passive: false });
    box.addEventListener('pointerdown', onPointerDown);
    box.addEventListener('pointerenter', onPointerEnter);
    box.addEventListener('pointermove', onPointerMove);
    box.addEventListener('pointerleave', onPointerLeave);
    box.addEventListener('click', onClick);
    return () => {
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('pointerdown', onPointerDown);
      box.removeEventListener('pointerenter', onPointerEnter);
      box.removeEventListener('pointermove', onPointerMove);
      box.removeEventListener('pointerleave', onPointerLeave);
      box.removeEventListener('click', onClick);
      dom.root.remove();
      domRef.current = null;
      last.x = Number.NaN;
    };
  }, [hasName, portal, connected, canvas, id]);

  // 2) 상자 내용 — 표시 props 가 바뀔 때만 다시 만든다(프레임 속도 아님).
  useEffect(() => {
    const dom = domRef.current;
    if (!dom || !hasName) return;
    const { box } = dom;
    lastRef.current.emphasis = sceneLookSettings.labelEmphasis;
    box.className = labelBoxClass(
      tone,
      alarmSeverity,
      inert,
      dimmed,
      sceneLookSettings.labelEmphasis,
    );
    box.title = titles?.tone[tone] ?? '';
    box.replaceChildren();
    if (tone === 'offline') {
      const icon = document.createElement('span');
      icon.innerHTML = iconSvg(ICON_WIFI_OFF, 'size-3 shrink-0');
      box.append(icon.firstElementChild as SVGElement);
    } else {
      const dotClass = labelToneDotClass(tone, alarmSeverity);
      if (dotClass) {
        const dot = document.createElement('span');
        dot.setAttribute('aria-hidden', 'true');
        dot.className = dotClass;
        box.append(dot);
      }
    }
    box.append(document.createTextNode(equipName ?? ''));
    const badge = (paths: string, title: string | undefined) => {
      const chip = document.createElement('span');
      chip.className = LABEL_BADGE_CLASS;
      if (title) chip.title = title;
      chip.innerHTML = iconSvg(paths, LABEL_BADGE_ICON_CLASS);
      box.append(chip);
    };
    if (bypass) badge(ICON_KEY_ROUND, titles?.bypass);
    if (freeSwing) badge(ICON_REFRESH_CW, titles?.freeSwing);
  }, [
    hasName,
    equipName,
    tone,
    alarmSeverity,
    inert,
    dimmed,
    bypass,
    freeSwing,
    titles,
  ]);

  // 3) 값 줄 — 목록이 바뀔 때만 행을 다시 만들고, 값은 useFrame 이 쓴다.
  useEffect(() => {
    const dom = domRef.current;
    if (!dom || !hasName) return;
    dom.readings.replaceChildren();
    dom.valueSpans = [];
    dom.readings.style.display = readings.length > 0 ? '' : 'none';
    for (const reading of readings) {
      const row = document.createElement('div');
      row.className = `flex items-baseline gap-1 font-sans text-[12px] leading-none font-bold whitespace-nowrap select-none ${dimmed ? 'opacity-30' : ''}`;
      row.style.color = READING_TEXT_COLOR;
      row.style.textShadow = READING_TEXT_SHADOW;
      if (reading.caption) {
        const caption = document.createElement('span');
        caption.textContent = reading.caption;
        row.append(caption);
      }
      const value = document.createElement('span');
      value.className = 'tabular-nums';
      value.textContent = LABEL_READING_EMPTY;
      row.append(value);
      dom.readings.append(row);
      dom.valueSpans.push(value);
    }
  }, [hasName, readings, dimmed]);

  // 4) 프레임 — 위치·표시·축소·값. 바뀐 값만 DOM 에 쓴다.
  useFrame(({ camera, size }) => {
    const dom = domRef.current;
    const group = groupRef.current;
    if (!dom || !group) return;
    const last = lastRef.current;

    // 관제 모드 토글(전역 설정)로 칩 강조가 바뀌면 클래스만 다시 쓴다.
    if (last.emphasis !== sceneLookSettings.labelEmphasis) {
      last.emphasis = sceneLookSettings.labelEmphasis;
      dom.box.className = labelBoxClass(
        tone,
        alarmRef.current,
        inert,
        dimmed,
        last.emphasis,
      );
    }
    group.getWorldPosition(worldPos.current);
    const dist = camera.position.distanceTo(worldPos.current);
    const alarm = alarmRef.current;
    // 평면(탑뷰) 모드에선 장비 마커(ScenePlanMarkers)가 이름을 맡는다 —
    // 알람 중인 라벨만 남긴다.
    const visible =
      !isBehindCamera(worldPos.current, camera) &&
      (alarm !== null ||
        (!sceneLookSettings.planView &&
          isLabelInRange(
            dist,
            sceneLookSettings.labelMaxDistance ?? LABEL_VISIBILITY_DISTANCE,
          )));
    if (visible !== last.visible) {
      dom.root.style.display = visible ? '' : 'none';
      last.visible = visible;
    }
    if (!visible) return;

    projectToScreen(
      worldPos.current,
      camera,
      size.width,
      size.height,
      screen.current,
    );
    const x = Math.round(screen.current.x * 10) / 10;
    const y = Math.round(screen.current.y * 10) / 10;
    if (x !== last.x || y !== last.y) {
      dom.root.style.transform = `translate3d(${x}px,${y}px,0)`;
      last.x = x;
      last.y = y;
    }
    const perspective = camera as { near?: number; far?: number };
    const z = labelZIndex(dist, perspective.near ?? 0.1, perspective.far ?? 1);
    if (z !== last.z) {
      dom.root.style.zIndex = String(z);
      last.z = z;
    }

    // 알람 라벨은 축소 면제. 배율은 단계로 끊겨 나와 매 프레임 재작성이 없다.
    const scale = alarm
      ? 1
      : labelScaleAtDistance(
          dist,
          sceneLookSettings.labelMinScale ?? LABEL_MIN_SCALE,
        );
    if (scale !== last.scale) {
      dom.scaler.style.transform = scale === 1 ? '' : `scale(${scale})`;
      last.scale = scale;
    }

    // 태그 값 줄 — 표기가 바뀔 때만 쓴다(값은 초당 수십 번 온다).
    const { readings: list, readValue: read } = readingsRef.current;
    for (let i = 0; i < list.length; i += 1) {
      const span = dom.valueSpans[i];
      if (!span) continue;
      const text = formatLabelReading(read?.(list[i].tagKey));
      if (span.textContent !== text) span.textContent = text;
    }
  });

  if (!hasName) return null;

  return <group ref={groupRef} position={localAnchor} />;
}

export { type AlarmHighlightSeverity };
