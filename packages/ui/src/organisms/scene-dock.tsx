import { Pin, PinOff } from 'lucide-react';
import {
  useEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { SceneToolbarButton } from '../molecules/scene-toolbar-button';

/**
 * 씬 독(dock) — 3D 뷰어 가장자리에 붙는 hover 펼침 · 고정(pin) 가능한 껍데기.
 *
 * 완전 제어형이다. 펼침/고정 여부와 hover·hold 판정은 features 의
 * useSceneDock 훅이 소유하고, 여기서는 그 상태를 그리고 이벤트를 훅의
 * handlers 로 넘길 뿐이다 (@crane/ui 는 상위 레이어를 import 할 수 없고
 * 테스트 인프라도 features 에만 있다).
 *
 * SceneDockRail — 오른쪽 세로 레일. 접힘: 얇은 그립 핸들. 펼침: 아이콘 열.
 * (하단 탭 패널 SceneDockPanel 은 2026-09-03 크레인 실시간 상태 테이블과
 * 함께 제거됐다.)
 *
 * 오버레이(미고정) 모드에서는 캔버스 위를 덮고, 고정 모드에서는 뷰어가
 * 같은 크기의 placeholder 를 캔버스 밖에 두어 레이아웃이 실제로 줄어든다.
 * 독 내용은 어느 모드든 같은 DOM 위치에 있고 CSS 로만 자리를 옮긴다 —
 * 안의 팝오버·포커스 상태가 리마운트로 끊기지 않게 하려는 것. 같은 이유로
 * 접힘은 언마운트가 아니라 transform + inert 다.
 *
 * 애니메이션은 transform/opacity 만 쓴다. 고정 전환은 캔버스 크기를 즉시
 * 바꾼다(크기를 트랜지션하면 R3F ResizeObserver 가 매 프레임 setSize 한다).
 */

/** 레일 접힘 핸들 폭(hover 히트 영역 겸). 시각 그립은 안쪽 4px. */
export const SCENE_DOCK_RAIL_HANDLE_WIDTH = '0.75rem';
/** 레일 펼침 시 아이콘 열 폭 (icon-sm 28px + 여백). */
export const SCENE_DOCK_RAIL_COLUMN_WIDTH = '2.5rem';
/** 레일 전체 폭 = 핸들 + 열. 고정 시 placeholder 폭. */
export const SCENE_DOCK_RAIL_WIDTH = '3.25rem';

/**
 * 독 껍데기가 호출하는 인터랙션 핸들러. features 의 useSceneDock 이 만든
 * 객체를 그대로 넘긴다 — 여기서는 판단하지 않고 연결만 한다.
 */
export interface SceneDockHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** 핸들 클릭 — 지연 없이 즉시 펼치거나 접는다. */
  onToggle: () => void;
  /** 접힘을 막는 조건 시작/끝 (팝오버 열림·키보드 포커스·드래그). 반드시 짝. */
  holdStart: () => void;
  holdEnd: () => void;
}

export interface SceneDockState {
  label: string;
  expanded: boolean;
  pinned: boolean;
  onPinnedChange: (next: boolean) => void;
  handlers: SceneDockHandlers;
}

/**
 * 독 판의 바탕 — 불투명한 테마 배경. 오버레이(미고정)·도킹(고정) 어느
 * 모드든 같은 색이라 pin 전후 외형이 바뀌지 않는다. 안의 버튼은
 * `[data-scene-dock]` 조상을 보고 글래스 판을 걷는다(SCENE_TOOLBAR_BUTTON_CLASS 주석).
 */
const BACKING_CLASS = 'bg-background text-foreground';

function isFocusVisible(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  try {
    return target.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * hold 조건 세 가지를 DOM 에서 감지해 handlers.holdStart/holdEnd 로 넘긴다.
 * - 팝오버·툴팁·컨텍스트 메뉴 열림: base-ui 가 트리거에 붙이는
 *   `data-popup-open` 을 MutationObserver 로 센다. 팝업 자체는 뷰어 루트로
 *   포털되어 독 DOM 밖이라 pointerleave 가 나므로, 이게 없으면 팝오버로
 *   마우스를 옮기는 순간 독이 접힌다.
 * - 키보드 포커스(:focus-visible)만 hold. 마우스 클릭 포커스까지 잡으면
 *   버튼을 누른 뒤 마우스를 치워도 다른 곳을 클릭할 때까지 안 접힌다.
 * - pointerdown ~ pointerup (스크롤바 드래그 등).
 */
function useSceneDockHold(
  containerRef: RefObject<HTMLDivElement | null>,
  handlers: SceneDockHandlers,
) {
  const { holdStart, holdEnd } = handlers;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof MutationObserver === 'undefined') {
      return;
    }
    let count = 0;
    const sync = () => {
      const next = element.querySelectorAll('[data-popup-open]').length;
      while (count < next) {
        holdStart();
        count += 1;
      }
      while (count > next) {
        holdEnd();
        count -= 1;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-popup-open'],
    });
    sync();
    return () => {
      observer.disconnect();
      while (count > 0) {
        holdEnd();
        count -= 1;
      }
    };
  }, [containerRef, holdEnd, holdStart]);

  const focusHeldRef = useRef(false);
  const pointerHeldRef = useRef(false);

  useEffect(
    () => () => {
      if (focusHeldRef.current) {
        focusHeldRef.current = false;
        holdEnd();
      }
      if (pointerHeldRef.current) {
        pointerHeldRef.current = false;
        holdEnd();
      }
    },
    [holdEnd],
  );

  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    if (focusHeldRef.current || !isFocusVisible(event.target)) {
      return;
    }
    focusHeldRef.current = true;
    holdStart();
  };

  const onBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    if (!focusHeldRef.current) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof Node && containerRef.current?.contains(related)) {
      return;
    }
    focusHeldRef.current = false;
    holdEnd();
  };

  const onPointerDownCapture = () => {
    if (pointerHeldRef.current) {
      return;
    }
    pointerHeldRef.current = true;
    holdStart();
    const release = () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      if (!pointerHeldRef.current) {
        return;
      }
      pointerHeldRef.current = false;
      holdEnd();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };

  return { onFocusCapture, onBlurCapture, onPointerDownCapture };
}

function SceneDockPinButton({
  pinned,
  onPinnedChange,
}: {
  pinned: boolean;
  onPinnedChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const label = pinned
    ? t('common:viewer3d.dockUnpin', { defaultValue: '고정 해제' })
    : t('common:viewer3d.dockPin', { defaultValue: '고정' });
  return (
    <SceneToolbarButton
      label={label}
      side="left"
      size="icon-sm"
      pressed={pinned}
      onClick={() => onPinnedChange(!pinned)}
    >
      {pinned ? <PinOff /> : <Pin />}
    </SceneToolbarButton>
  );
}

export interface SceneDockRailProps extends SceneDockState {
  children: ReactNode;
}

export function SceneDockRail({
  label,
  expanded,
  pinned,
  onPinnedChange,
  handlers,
  children,
}: SceneDockRailProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hold = useSceneDockHold(containerRef, handlers);
  const collapsed = !expanded;
  const handleLabel = expanded
    ? t('common:viewer3d.dockCollapse', { defaultValue: '접기' })
    : t('common:viewer3d.dockExpand', { defaultValue: '펼치기' });

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      data-slot="scene-dock-rail"
      data-scene-dock=""
      data-state={expanded ? 'expanded' : 'collapsed'}
      data-pinned={pinned || undefined}
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-20"
      style={{
        // 고정 시엔 그립 핸들이 없으므로 아이콘 열 폭만 차지한다.
        width: pinned ? SCENE_DOCK_RAIL_COLUMN_WIDTH : SCENE_DOCK_RAIL_WIDTH,
      }}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onKeyDown={handlers.onKeyDown}
      {...hold}
    >
      {/* 슬라이딩 단위 = [핸들][아이콘 열]. 접히면 열 폭만큼 오른쪽으로 밀어
          핸들만 뷰어 안에 남는다 (루트 overflow-hidden 이 나머지를 자른다).
          고정 시엔 항상 펼침이라 핸들을 두지 않는다 — 도킹된 레일은 그립이
          아니라 레이아웃의 일부다. */}
      <div
        className="pointer-events-auto flex h-full transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{
          transform: collapsed
            ? `translateX(${SCENE_DOCK_RAIL_COLUMN_WIDTH})`
            : undefined,
        }}
      >
        {pinned ? null : (
          <button
            type="button"
            aria-label={handleLabel}
            aria-expanded={expanded}
            onClick={handlers.onToggle}
            className="group flex shrink-0 cursor-pointer items-center justify-center focus-visible:outline-none"
            style={{ width: SCENE_DOCK_RAIL_HANDLE_WIDTH }}
          >
            <span
              aria-hidden
              className="h-12 w-1 rounded-full bg-black/45 shadow-sm transition-colors group-hover:bg-black/70 group-focus-visible:bg-black/70 dark:bg-white/55 dark:group-hover:bg-white/85 dark:group-focus-visible:bg-white/85"
            />
          </button>
        )}
        <div
          aria-hidden={collapsed}
          inert={collapsed}
          className={cn(
            BACKING_CLASS,
            'border-border flex h-full shrink-0 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto border-l py-1.5 transition-opacity duration-150 motion-reduce:transition-none',
            collapsed && 'opacity-0',
          )}
          style={{ width: SCENE_DOCK_RAIL_COLUMN_WIDTH }}
        >
          {children}
          <div className="mt-auto shrink-0 pt-1.5">
            <SceneDockPinButton
              pinned={pinned}
              onPinnedChange={onPinnedChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
