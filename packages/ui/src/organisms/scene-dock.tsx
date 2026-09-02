import { Pin, PinOff } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
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
 * 두 가지 형태:
 * - SceneDockRail  — 오른쪽 세로 레일. 접힘: 얇은 그립 핸들. 펼침: 아이콘 열.
 * - SceneDockPanel — 하단 탭 패널. 접힘: 탭 줄(핸들). 펼침: 탭 내용이 위로.
 *
 * 오버레이(미고정) 모드에서는 캔버스 위를 덮고, 고정 모드에서는 뷰어가
 * 같은 크기의 placeholder 를 캔버스 밖에 두어 레이아웃이 실제로 줄어든다.
 * 독 내용은 어느 모드든 같은 DOM 위치에 있고 CSS 로만 자리를 옮긴다 —
 * 하단 패널의 실시간 테이블은 행 상태가 컴포넌트 로컬이라 리마운트되면
 * 비어 버린다. 같은 이유로 접힘은 언마운트가 아니라 transform + inert 다.
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
/** 하단 패널 접힘 그립 핸들 높이(hover 히트 영역 겸). 레일 핸들과 같은 두께. */
export const SCENE_DOCK_PANEL_HANDLE_HEIGHT = '0.75rem';
/** 하단 패널 펼침 시 탭 줄 높이. */
export const SCENE_DOCK_PANEL_STRIP_HEIGHT = '1.75rem';
/** 하단 패널 오버레이(미고정) 펼침 높이 — 뷰어 높이 대비. */
export const SCENE_DOCK_PANEL_OVERLAY_HEIGHT = '45%';

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

export interface SceneDockTab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * 독 판의 바탕 — 불투명한 테마 배경. 오버레이(미고정)·도킹(고정) 어느
 * 모드든 같은 색이라 pin 전후 외형이 바뀌지 않고, 하단 패널 내용(테이블의
 * bg-background)과도 이어진다. 안의 버튼은 `[data-scene-dock]` 조상을 보고
 * 글래스 판을 걷는다(SCENE_TOOLBAR_BUTTON_CLASS 주석).
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
  side,
  size,
}: {
  pinned: boolean;
  onPinnedChange: (next: boolean) => void;
  side: 'left' | 'top';
  size: 'icon-sm' | 'icon-xs';
}) {
  const { t } = useTranslation();
  const label = pinned
    ? t('common:viewer3d.dockUnpin', { defaultValue: '고정 해제' })
    : t('common:viewer3d.dockPin', { defaultValue: '고정' });
  return (
    <SceneToolbarButton
      label={label}
      side={side}
      size={size}
      pressed={pinned}
      onClick={() => onPinnedChange(!pinned)}
    >
      {pinned ? <PinOff /> : <Pin />}
    </SceneToolbarButton>
  );
}

export interface SceneDockRailProps extends SceneDockState {
  /** 아래쪽 여백 — 하단 독 핸들과 겹치지 않게 뷰어가 계산해 넘긴다. */
  bottomInset: string;
  children: ReactNode;
}

export function SceneDockRail({
  label,
  expanded,
  pinned,
  onPinnedChange,
  handlers,
  bottomInset,
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
      className="pointer-events-none absolute top-0 right-0 z-20"
      style={{
        bottom: bottomInset,
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
              side="left"
              size="icon-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 포인터 y 좌표를 뷰어 높이 대비 하단 패널 크기(%)로 환산. */
function dockSizeFromPointer(
  rootRect: DOMRect,
  clientY: number,
  minSize: number,
  maxSize: number,
): number {
  if (rootRect.height <= 0) {
    return minSize;
  }
  const ratio = ((rootRect.bottom - clientY) / rootRect.height) * 100;
  return Math.min(maxSize, Math.max(minSize, ratio));
}

const RESIZE_KEY_STEP = 2;

function SceneDockResizeHandle({
  size,
  minSize,
  maxSize,
  onSizeChange,
}: {
  size: number;
  minSize: number;
  maxSize: number;
  onSizeChange: (next: number) => void;
}) {
  const { t } = useTranslation();

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // 컨테이너(absolute)의 offsetParent 가 뷰어 루트다 — 퍼센트의 기준.
    const root = event.currentTarget.closest<HTMLElement>(
      '[data-slot="scene-dock-panel"]',
    )?.parentElement;
    if (!root) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget;
    const rootRect = root.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: globalThis.PointerEvent) => {
      onSizeChange(
        dockSizeFromPointer(rootRect, moveEvent.clientY, minSize, maxSize),
      );
    };
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onSizeChange(Math.min(maxSize, size + RESIZE_KEY_STEP));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onSizeChange(Math.max(minSize, size - RESIZE_KEY_STEP));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={Math.round(size)}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-label={t('common:viewer3d.dockResize', {
        defaultValue: '패널 크기 조절',
      })}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 cursor-row-resize touch-none focus-visible:outline-none"
    >
      {/* 시각은 얇은 선 하나 — 가운데 막대를 두면 접힘 그립처럼 읽힌다.
          hover·포커스 시 선 색만 진해져 끌 수 있음을 알린다. */}
      <span
        aria-hidden
        className="bg-border group-hover:bg-ring group-focus-visible:bg-ring absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors"
      />
    </div>
  );
}

export interface SceneDockPanelProps extends SceneDockState {
  tabs: SceneDockTab[];
  /** 고정 시 높이(뷰어 대비 %). 오버레이 모드는 SCENE_DOCK_PANEL_OVERLAY_HEIGHT 고정. */
  size: number;
  onSizeChange: (next: number) => void;
  minSize: number;
  maxSize: number;
}

export function SceneDockPanel({
  label,
  expanded,
  pinned,
  onPinnedChange,
  handlers,
  tabs,
  size,
  onSizeChange,
  minSize,
  maxSize,
}: SceneDockPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hold = useSceneDockHold(containerRef, handlers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 선택 탭이 사라졌으면(탭 배열 교체) 첫 탭으로 — effect 없이 렌더 중 도출
  const activeId = tabs.some((tab) => tab.id === selectedId)
    ? selectedId
    : (tabs[0]?.id ?? null);
  const collapsed = !expanded;
  const handleLabel = expanded
    ? t('common:viewer3d.dockCollapse', { defaultValue: '접기' })
    : t('common:viewer3d.dockExpand', { defaultValue: '펼치기' });

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      data-slot="scene-dock-panel"
      data-scene-dock=""
      data-state={expanded ? 'expanded' : 'collapsed'}
      data-pinned={pinned || undefined}
      // 하단 영역은 항상 전체 폭 — 우측 레일이 이 위에서 끝난다(뷰어가 레일의
      // bottom 을 이 패널만큼 띄운다). 미고정 패널이 펼쳐질 때는 레일을 덮는다.
      className="pointer-events-none absolute right-0 bottom-0 left-0 z-20"
      style={{
        height: pinned ? `${size}%` : SCENE_DOCK_PANEL_OVERLAY_HEIGHT,
      }}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onKeyDown={handlers.onKeyDown}
      {...hold}
    >
      {/* 슬라이딩 단위 = [그립][탭 줄][내용]. 접히면 그립 높이만 남기고 아래로
          밀어 레일과 같은 얇은 그립만 보인다. 고정 시엔 항상 펼침이라 그립을
          두지 않는다. */}
      <div
        className="pointer-events-auto relative flex h-full flex-col transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{
          transform: collapsed
            ? `translateY(calc(100% - ${SCENE_DOCK_PANEL_HANDLE_HEIGHT}))`
            : undefined,
        }}
      >
        {pinned ? (
          <SceneDockResizeHandle
            size={size}
            minSize={minSize}
            maxSize={maxSize}
            onSizeChange={onSizeChange}
          />
        ) : (
          <button
            type="button"
            aria-label={handleLabel}
            aria-expanded={expanded}
            onClick={handlers.onToggle}
            className="group flex shrink-0 cursor-pointer items-center justify-center focus-visible:outline-none"
            style={{ height: SCENE_DOCK_PANEL_HANDLE_HEIGHT }}
          >
            <span
              aria-hidden
              className="h-1 w-12 rounded-full bg-black/45 shadow-sm transition-colors group-hover:bg-black/70 group-focus-visible:bg-black/70 dark:bg-white/55 dark:group-hover:bg-white/85 dark:group-focus-visible:bg-white/85"
            />
          </button>
        )}
        <div
          aria-hidden={collapsed}
          inert={collapsed}
          className={cn(
            'flex min-h-0 flex-1 flex-col transition-opacity duration-150 motion-reduce:transition-none',
            collapsed && 'opacity-0',
          )}
        >
          <div
            role="tablist"
            className={cn(
              BACKING_CLASS,
              'border-border flex shrink-0 items-stretch gap-1 border-t px-1.5',
            )}
            style={{ height: SCENE_DOCK_PANEL_STRIP_HEIGHT }}
          >
            {tabs.map((tab) => {
              const active = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(tab.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 border-b-2 px-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none',
                    active
                      ? 'border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground focus-visible:text-foreground border-transparent',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-1">
              <SceneDockPinButton
                pinned={pinned}
                onPinnedChange={onPinnedChange}
                side="top"
                size="icon-xs"
              />
            </div>
          </div>
          <div className="bg-background text-foreground border-border min-h-0 flex-1 border-t">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tabpanel"
                hidden={tab.id !== activeId}
                className="h-full min-h-0"
              >
                {tab.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
