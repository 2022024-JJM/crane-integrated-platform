import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { LOCATION_STATUS_META, type Location } from '../../../entities/location/model/types'
import { cn } from '../../../lib/utils'
import { StatusDot } from '../../../ui/atoms/StatusDot'

/** 상위 줄의 공장 탭 하나 — 표시명만 있으면 된다 (공정 엔티티를 끌어오지 않는다) */
export interface LocationTabFactory {
  id: string
  displayName: string
}

/** 경로·문구는 공정이 정한다 — 이 컴포넌트는 어느 공정의 것인지 모른다 */
export interface LocationTabsRouting {
  /** 공장 전체 뷰 경로 (상위 줄·'전체' 링크) */
  factoryHref: (factoryId: string) => string
  /** 정반(베이) 뷰 경로 */
  bayHref: (factoryId: string, bayId: string) => string
  /** nav aria-label */
  navLabel: string
  /** '전체' 링크 문구 */
  allLabel: string
  /** 정반 링크 title — 이름·운영코드 */
  bayTitle: (name: string, workCntr: string) => string
}

interface LocationTabsProps {
  factories: LocationTabFactory[]
  locations: Location[]
  routing: LocationTabsRouting
  currentFactoryId: string
  /** 정반 화면이면 그 정반 id — 공장 전체 뷰에서는 없다 */
  currentLocationId?: string
  /** 3D 뷰와 공유하는 강조 대상 — 탭에 손을 얹으면 뷰 쪽 정반도 켜진다 */
  highlightedId?: string | null
  onHighlight?: (locationId: string | null) => void
  /**
   * 어떤 바탕 위에 서는가.
   * - `surface`: 문서 흐름 속 한 줄 (정반 화면).
   * - `glass`: 3D 뷰포트 **안에** 겹쳐 뜨는 유리 도구줄 안 — 면 색(surface)을 그대로
   *   쓰면 유리가 아니라 그냥 판이 되고, 본문 글자색은 점군 위에서 읽히지 않는다.
   * - `attached`: 3D 상자의 **윗모서리에 붙는 탭** — 활성 탭이 뷰포트와 같은 바탕을
   *   입고 아래 테두리를 지워, 탭과 3D 가 한 창으로 읽힌다.
   */
  tone?: 'surface' | 'glass' | 'attached'
  /**
   * `attached` 탭이 입을 색 — 3D 상자의 윗변 색이다 (표시 모드가 정한다).
   * 주지 않으면 뷰포트 기본 바탕색으로 선다.
   */
  attachedColors?: { background: string; foreground: string }
  /**
   * 두 줄 중 무엇을 그릴지. 공장 줄과 정반 줄이 서로 다른 자리에 설 때 쓴다
   * (공장은 3D 상자 위 탭으로, 정반은 뷰포트 안 도구줄로).
   */
  parts?: 'both' | 'factories' | 'bays'
  className?: string
}

/*
 * 정반 상태 점 — 색·모양·이름을 상태 팔레트에서 가져온다.
 *
 * 예전에는 색만 있는 점이었다. 초록/노랑/회색이 무엇을 뜻하는지 범례도 툴팁도 없어
 * 색을 못 보는 사람에게는 세 상태가 한 덩어리였다(감사 A8). 이제 모양이 갈리고
 * (원·삼각·막대) 손을 얹으면 상태 이름이 뜬다.
 */

/**
 * 공장·정반(베이) 전환 탭 — 워크스페이스 공통 부품.
 *
 * 조립 워크스페이스에서 태어났고(AssemblyLocationTabs), 의장 워크스페이스가 같은 문법을
 * 요구해(W7-10 — 두 화면이 같아야 한다) 경로·문구만 주입받는 꼴로 승격했다. 공정 몫은
 * `routing` 뿐이다 — 이 컴포넌트는 어느 공정의 탭인지 모른다.
 *
 * 같은 내용을 좌측 트리로 두면 폭을 256px 먹는데, 이 화면에서 폭은 곧 뷰어의
 * 해상도다 — 그래서 위쪽으로 눕히되, 공장(상위)과 정반(하위)은 **위아래 두 줄로**
 * 나눈다. 한 줄에 섞으면 어느 것이 어느 것에 속하는지가 사라진다.
 *
 * 강조는 한 곳에만 준다: 채워진 강조색은 **지금 보고 있는 것**(정반, 또는 공장 전체)
 * 하나뿐이고, 상위 줄의 현재 공장은 눌린 세그먼트(유리 위에서는 밑줄 탭)로만 표시한다.
 * 두 줄 다 채우면 어느 쪽이 지금인지 눈이 못 고른다.
 * 넘치면 페이지가 아니라 각 줄이 가로로 구른다.
 *
 * 유리(`tone="glass"`)에서는 공장 줄이 **판 위에 얹힌 탭**이 된다 — 도구줄의 맨 위
 * 모서리까지 물려 밑줄 하나로 아래 내용과 이어지므로, 그 아래 전부가 "이 공장의 것"으로
 * 읽힌다. 그래서 이 톤은 좌우 3(=px-3) 패딩을 가진 판 안에 들어가는 것을 전제로 한다
 * (ViewportToolbar).
 */
export function LocationTabs({
  factories,
  locations,
  routing,
  currentFactoryId,
  currentLocationId,
  highlightedId,
  onHighlight,
  tone = 'surface',
  parts = 'both',
  attachedColors,
  className,
}: LocationTabsProps) {
  const { t } = useTranslation()
  const bays = locations.filter((location) => location.factoryId === currentFactoryId)
  const glass = tone === 'glass'
  const attached = tone === 'attached'

  return (
    <nav
      aria-label={routing.navLabel}
      className={cn(
        'flex flex-col',
        // 유리·탭에서는 판을 또 깔지 않는다 — 도구줄과 3D 상자가 이미 그 판이다
        glass || attached ? 'min-w-0' : 'gap-1 rounded-inshop-lg border border-border bg-surface p-1',
        className,
      )}
    >
      {/* 상위 — 공장. 누르면 그 공장의 전체 뷰로 간다 */}
      {parts !== 'bays' && (
      <div
        className={cn(
          'flex overflow-x-auto',
          attached
            ? /*
               * 3D 상자 위에 얹힌 탭 줄.
               * `-mb-px` 로 한 줄 내려 앉혀 탭의 아래 테두리가 상자의 위 테두리와 겹치고,
               * `z` 로 그 위에 놓아 활성 탭의 바탕이 그 선을 지운다 — 그래야 탭과 3D 가
               * 두 개가 아니라 한 창으로 읽힌다. 왼쪽 여백은 상자의 둥근 모서리를 피한 만큼.
               */
              'relative z-10 -mb-px items-end gap-1.5 pl-3'
            : 'items-center gap-0.5 self-start rounded-inshop-md bg-surface-secondary p-0.5',
        )}
      >
        {factories.map((factory) => {
          const isCurrent = factory.id === currentFactoryId

          return (
            <Link
              key={factory.id}
              to={routing.factoryHref(factory.id)}
              aria-current={isCurrent ? 'page' : undefined}
              /* 붙은 탭의 색은 3D 상자의 윗변에서 온다 — 클래스가 아니라 팔레트가 정한다 */
              style={
                attached && isCurrent && attachedColors
                  ? { background: attachedColors.background, color: attachedColors.foreground }
                  : undefined
              }
              className={cn(
                'flex shrink-0 items-center text-inshop-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                attached
                  ? [
                      'relative rounded-t-inshop-lg border px-3.5',
                      isCurrent
                        ? [
                            /*
                             * 활성 탭은 브라우저 탭 문법 그대로 —
                             *  - 비활성보다 **한 단 크다** (h-8 vs h-7, 반박자 굵은 글자).
                             *  - 아래 테두리를 투명으로 두면 제 바탕이 그 자리를 채워 상자와 이어진다.
                             *  - 윗변의 강조색 짧은 줄이 "지금 이 창"을 멀리서도 집어 준다.
                             */
                            'h-8 border-border border-b-transparent bg-viewport font-semibold text-[#eef2f7]',
                            'before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-b-full before:bg-accent',
                          ]
                        : [
                            // 비활성도 판은 갖는다 — 맨글자만 두면 탭이 아니라 링크로 읽힌다
                            'h-7 border-border/60 border-b-transparent bg-surface-secondary/60',
                            'text-foreground/58 hover:bg-surface-secondary hover:text-foreground',
                          ],
                    ]
                  : [
                      'h-6 rounded-inshop-sm px-2',
                      isCurrent
                        ? 'bg-surface text-foreground shadow-sm ring-1 ring-material-border'
                        : 'text-foreground/58 hover:text-foreground',
                    ],
              )}
            >
              {factory.displayName}
            </Link>
          )
        })}
      </div>
      )}

      {/* 하위 — 그 공장의 정반. 한 칸 들여써서 위에 매달린 것으로 읽히게 한다 */}
      {parts !== 'factories' && (
      <div
        className={cn(
          'flex items-center gap-0.5 overflow-x-auto',
          // 유리에서는 공장 줄이 딴 데 있으므로 매달릴 곳이 없다 — 들여쓰지 않는다
          glass ? 'min-w-0' : 'pl-2',
        )}
      >
        <Link
          to={routing.factoryHref(currentFactoryId)}
          aria-current={currentLocationId ? undefined : 'page'}
          className={cn(
            'flex h-6 shrink-0 items-center rounded-inshop-sm px-2 text-inshop-xs transition-colors',
            'focus:outline-none focus-visible:ring-2',
            glass ? 'focus-visible:ring-glass-accent' : 'focus-visible:ring-accent',
            glass
              ? currentLocationId
                ? 'text-glass-foreground/68 hover:bg-glass-hover hover:text-glass-foreground'
                : 'bg-glass-active font-medium text-glass-accent ring-1 ring-inset ring-glass-accent/40'
              : currentLocationId
                ? 'text-foreground/68 hover:bg-foreground/6 hover:text-foreground'
                : 'bg-accent font-medium text-on-accent shadow-sm',
          )}
        >
          {routing.allLabel}
        </Link>

        <span
          aria-hidden="true"
          className={cn('mx-1 h-3.5 w-px shrink-0', glass ? 'bg-glass-border' : 'bg-border')}
        />

        {bays.map((bay) => {
          const isActive = bay.id === currentLocationId
          const isHighlighted = !isActive && highlightedId === bay.id

          return (
            <Link
              key={bay.id}
              to={routing.bayHref(currentFactoryId, bay.id)}
              onMouseEnter={() => onHighlight?.(bay.id)}
              onMouseLeave={() => onHighlight?.(null)}
              onFocus={() => onHighlight?.(bay.id)}
              onBlur={() => onHighlight?.(null)}
              aria-current={isActive ? 'page' : undefined}
              title={routing.bayTitle(bay.name, bay.workCntr)}
              className={cn(
                'flex h-6 shrink-0 items-center gap-1.5 rounded-inshop-sm px-2 text-inshop-xs transition-colors',
                'focus:outline-none focus-visible:ring-2',
                glass ? 'focus-visible:ring-glass-accent' : 'focus-visible:ring-accent',
                glass
                  ? isActive
                    ? 'bg-glass-active font-medium text-glass-accent ring-1 ring-inset ring-glass-accent/40'
                    : isHighlighted
                      ? 'bg-glass-active text-glass-foreground'
                      : 'text-glass-foreground/70 hover:bg-glass-hover hover:text-glass-foreground'
                  : isActive
                    ? 'bg-accent font-medium text-on-accent shadow-sm'
                    : isHighlighted
                      ? 'bg-accent/10 text-foreground'
                      : 'text-foreground/70 hover:bg-foreground/6 hover:text-foreground',
              )}
            >
              <StatusDot
                meaning={LOCATION_STATUS_META[bay.status].meaning}
                label={t(LOCATION_STATUS_META[bay.status].labelKey)}
                size={7}
                glass={glass}
                /* 강조색으로 채워진 현재 항목 위에서는 상태색이 묻힌다 — 잉크를 뒤집는다 */
                className={isActive && !glass ? 'text-on-accent/80' : undefined}
              />
              <span className="whitespace-nowrap">{bay.name}</span>
              {/* 정반코드는 현재 항목에서만 — 늘 붙어 있으면 줄이 코드로 가득 찬다 */}
              {isActive && (
                <span
                  className={cn(
                    'font-mono text-2xs',
                    glass ? 'text-glass-foreground/60' : 'text-on-accent/70',
                  )}
                >
                  {bay.workCntr}
                </span>
              )}
            </Link>
          )
        })}
      </div>
      )}
    </nav>
  )
}
