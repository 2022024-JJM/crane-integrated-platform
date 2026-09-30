import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { KeyRound, RefreshCw, WifiOff } from 'lucide-react';
import { useRef, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import type {
  EquipmentLabelState,
  EquipmentRuntimeStatus,
} from '@crane/core/types/status';
import {
  formatLabelReading,
  LABEL_READING_EMPTY,
  type ModelLabelReading,
  type ModelLabelValueReader,
} from '../lib/label-reading';
import { isLabelInRange, labelScaleAtDistance } from '../lib/label-scale';

/**
 * 거리에 따른 숨김·축소는 lib/label-scale.ts 의 규칙이다(눈금의 점·숫자와
 * 공유). 알람이 활성화된 라벨은 멀리서도 보여야 하므로 숨김·축소 모두 면제.
 * 표시 상태(고장·Bypass)는 크기를 바꾸지 않는다 — 상태는 색과 아이콘으로만
 * 나타낸다.
 */

type AlarmHighlightSeverity = 'critical' | 'high' | 'medium' | 'info';

const ALARM_LABEL_CLASS: Record<AlarmHighlightSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  info: 'bg-blue-500 text-white',
};

/**
 * 표시 상태 색 — 판정은 features/3d lib/model-label-state.ts. 알람이 없으면
 * 라벨 배경이 곧 상태다(점 없음 — 같은 정보를 두 번 그리지 않는다). 알람이
 * 있으면 배경은 알람색이 차지하므로 상태는 이름 앞 점으로만 남는다. unknown 은
 * 기본 검정 배경.
 *
 * 고장·가동·운전 전원 On·Off 는 ACMS 매뉴얼의 Crane ID Box 그대로다 — 그림에서 뽑은
 * 색(적·녹·황·회), 검은 테두리, 글자는 적색만 흰색이고 나머지는 검정. 가동
 * 색은 features/3d lib/model-runtime-status.ts 의 RUNTIME_STATUS_COLORS 와
 * 함께 바꾼다. 통신두절은 ACMS 에 없는 상태라 기존 색(zinc)을 쓴다. 꺼짐과
 * 통신두절은 둘 다 회색이라 통신두절만 흐리고 이름 앞에 끊김 아이콘을 둔다.
 */
const LABEL_TONE_DOT_CLASS: Record<
  Exclude<EquipmentRuntimeStatus, 'offline' | 'unknown'>,
  string
> = {
  fault: 'bg-[#ff0000]',
  running: 'bg-[#3ab426]',
  standby: 'bg-[#ffff00]',
  off: 'bg-[#a6a6a6]',
};
const LABEL_TONE_CLASS: Record<EquipmentRuntimeStatus, string> = {
  fault: 'border border-black bg-[#ff0000] text-white',
  running: 'border border-black bg-[#3ab426] text-black',
  standby: 'border border-black bg-[#ffff00] text-black',
  off: 'border border-black bg-[#a6a6a6] text-black',
  offline: 'bg-zinc-700/90 text-zinc-100 ring-1 ring-zinc-400/60',
  unknown: 'bg-black/60 text-white',
};

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

const UNKNOWN_STATE: EquipmentLabelState = {
  tone: 'unknown',
  bypass: false,
  freeSwing: false,
};

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
   * DOM 을 붙일 컨테이너(drei Html 의 portal). 분할 화면은 타일 컨테이너를
   * 넘긴다 — Html 이 이 요소 기준으로 위치를 쓴다. 없으면 캔버스 옆.
   */
  portal?: RefObject<HTMLElement | null>;
  onSelect?: (id: string, event?: never) => void;
  onHoverStart?: (id: string, clientX: number, clientY: number) => void;
  onHoverMove?: (id: string, clientX: number, clientY: number) => void;
  onHoverEnd?: (id: string) => void;
}

export function ModelLabel({
  id,
  equipName,
  localAnchor,
  alarmSeverity = null,
  state = UNKNOWN_STATE,
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
  const divRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<Group>(null);
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tempWorldPos = useRef(new Vector3());
  const lastVisibleRef = useRef(true);
  const lastScaleRef = useRef(1);
  const { tone, bypass, freeSwing } = state;

  // 태그 값 줄 — 보이는 라벨만, 표기가 바뀔 때만 쓴다(값은 초당 수십 번 온다).
  const writeReadings = () => {
    for (let i = 0; i < readings.length; i += 1) {
      const span = valueRefs.current[i];
      if (!span) continue;
      const text = formatLabelReading(readValue?.(readings[i].tagKey));
      if (span.textContent !== text) span.textContent = text;
    }
  };

  // 카메라 거리에 따라 라벨을 숨긴다. setState 대신 ref 기반 style mutate라
  // React 리렌더가 발생하지 않는다. 알람이 활성화된 라벨은 항상 보여준다.
  useFrame((frame) => {
    const div = divRef.current;
    const group = groupRef.current;
    if (!div || !group) return;

    if (alarmSeverity) {
      if (!lastVisibleRef.current) {
        div.style.display = '';
        lastVisibleRef.current = true;
      }
      if (lastScaleRef.current !== 1) {
        div.style.transform = '';
        lastScaleRef.current = 1;
      }
      writeReadings();
      return;
    }

    // group은 primitive(clone)의 자식이므로 부모 transform이 적용된 worldMatrix
    // 를 갖는다. getWorldPosition이 그 결과를 추출.
    group.getWorldPosition(tempWorldPos.current);
    const dist = frame.camera.position.distanceTo(tempWorldPos.current);
    const visible = isLabelInRange(dist);
    if (visible !== lastVisibleRef.current) {
      div.style.display = visible ? '' : 'none';
      lastVisibleRef.current = visible;
    }
    if (!visible) return;

    // drei <Html>은 wrapper에 자체 transform을 걸므로, 스케일은 우리가 소유한
    // 안쪽 div에 적용해 충돌을 피한다. 배율은 단계로 끊겨 나와 매 프레임
    // style 재작성이 없다.
    const scale = labelScaleAtDistance(dist);
    if (scale !== lastScaleRef.current) {
      div.style.transform = scale === 1 ? '' : `scale(${scale})`;
      lastScaleRef.current = scale;
    }
    writeReadings();
  });

  if (!equipName) {
    return null;
  }

  // 흐린 라벨(포커스 밖)과 비대화형 라벨(분할 타일)은 포인터를 받지 않는다.
  const inert = dimmed || !interactive;

  return (
    <group ref={groupRef} position={localAnchor}>
      {/* drei 의 portal 타입은 non-null RefObject 라 캐스팅한다 — 분할
          타일 컨테이너는 마운트 뒤에 채워진다. */}
      <Html
        center
        zIndexRange={[5, 0]}
        portal={portal as RefObject<HTMLElement> | undefined}
      >
        {/* 숨김·축소는 상자와 값 줄을 함께 감싼 이 요소에 건다. 감싼 요소의
            크기는 상자 하나다 — 값 줄은 흐름 밖(absolute)에서 상자 위로 쌓여,
            값 줄이 몇 개든 상자는 제자리에 있다. 포인터는 상자만 받는다. */}
        <div ref={divRef} className="pointer-events-none relative">
          <div
            title={titles?.tone[tone]}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight font-semibold whitespace-nowrap drop-shadow ${alarmSeverity ? ALARM_LABEL_CLASS[alarmSeverity] : LABEL_TONE_CLASS[tone]} ${inert ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'} ${dimmed ? 'opacity-30' : tone === 'offline' && !alarmSeverity ? 'opacity-70' : ''}`}
            onPointerDown={
              inert
                ? undefined
                : (event) => {
                    event.stopPropagation();
                  }
            }
            onPointerEnter={
              inert
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    onHoverStart?.(id, event.clientX, event.clientY);
                  }
            }
            onPointerMove={
              inert
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    onHoverMove?.(id, event.clientX, event.clientY);
                  }
            }
            onPointerLeave={
              inert
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    onHoverEnd?.(id);
                  }
            }
            onClick={
              inert
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    onSelect?.(id);
                  }
            }
          >
            {tone === 'offline' ? (
              <WifiOff aria-hidden className="size-3 shrink-0" />
            ) : alarmSeverity && tone !== 'unknown' ? (
              <span
                aria-hidden
                className={`inline-block size-2 shrink-0 rounded-full ring-1 ring-black/40 ${LABEL_TONE_DOT_CLASS[tone]}`}
              />
            ) : null}
            {equipName}
            {bypass ? (
              <span title={titles?.bypass} className={LABEL_BADGE_CLASS}>
                <KeyRound aria-hidden className={LABEL_BADGE_ICON_CLASS} />
              </span>
            ) : null}
            {freeSwing ? (
              <span title={titles?.freeSwing} className={LABEL_BADGE_CLASS}>
                <RefreshCw aria-hidden className={LABEL_BADGE_ICON_CLASS} />
              </span>
            ) : null}
          </div>
          {readings.length > 0 ? (
            // 상자 바로 위에서 위쪽으로 쌓는다 — 첫 값이 상자에 가장 가깝다.
            <div className="absolute bottom-full left-1/2 mb-0.5 flex -translate-x-1/2 flex-col-reverse items-center gap-0.5">
              {readings.map((reading, i) => (
                <div
                  key={reading.id}
                  className={`flex items-baseline gap-1 font-sans text-[12px] leading-none font-bold whitespace-nowrap select-none ${dimmed ? 'opacity-30' : ''}`}
                  style={{
                    color: READING_TEXT_COLOR,
                    textShadow: READING_TEXT_SHADOW,
                  }}
                >
                  {reading.caption ? <span>{reading.caption}</span> : null}
                  {/* 값은 useFrame 이 textContent 로 쓴다 — React 자식을 두지 않는다. */}
                  <span
                    ref={(element) => {
                      valueRefs.current[i] = element;
                      if (element && !element.textContent) {
                        element.textContent = LABEL_READING_EMPTY;
                      }
                    }}
                    className="tabular-nums"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

export { type AlarmHighlightSeverity };
