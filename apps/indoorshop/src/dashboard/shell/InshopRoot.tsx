import { lazy, Suspense, useMemo } from 'react'
import { useRoutes, type RouteObject } from 'react-router-dom'
import { FixedViewportProvider } from '../shared/lib/fixed-viewport/FixedViewportProvider'
import { useFixedViewport } from '../shared/lib/fixed-viewport/useFixedViewport'
import { FontScaleProvider } from '../shared/lib/font-scale/FontScaleProvider'
import { getProcessRoutes } from '../shared/model/processRegistry'
import { GlobalSearch } from '../shared/features/global-search'
import { TourController } from '../shared/features/tour'
import { Spinner } from '../shared/ui/atoms/Spinner'
import { useTranslation } from '../shared/lib/i18n/useTranslation'
import { cn } from '../shared/lib/utils'

/*
 * 공정 모듈 등록 + 번역 병합. 라우트 수집(getProcessRoutes)보다 먼저 끝나야 하므로
 * 원본 router.tsx 와 같은 이유로 여기서 직접 끌어온다.
 */
import '../app/bootstrap'

/*
 * 서체는 npm 패키지로 번들한다 — OT망에서는 외부 CDN(Google Fonts 등)에 나가지 못한다.
 * dynamic-subset 은 한글 글리프를 청크로 쪼개 실제로 쓰인 것만 받는다.
 * (IBM Plex Mono 는 셸 global.css 가 이미 싣고 있어 여기서 또 부르지 않는다.)
 */
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'

/*
 * 공통 화면 — 원본 app/router.tsx 의 children 과 같다. 공정 화면은 여기 적지 않는다:
 * 각 모듈이 module.ts 에서 선언한 것을 레지스트리가 모아 오므로 공정이 늘어도 이
 * 파일은 그대로다.
 */
const DashboardPage = lazy(() =>
  import('../shared/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const SettingsPage = lazy(() =>
  import('../shared/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const PerformancePage = lazy(() =>
  import('../shared/pages/PerformancePage').then((m) => ({ default: m.PerformancePage })),
)
const DocsPage = lazy(() => import('../shared/pages/DocsPage').then((m) => ({ default: m.DocsPage })))
const DocViewerPage = lazy(() =>
  import('../shared/pages/DocViewerPage').then((m) => ({ default: m.DocViewerPage })),
)
const NotFoundPage = lazy(() =>
  import('../shared/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

const MOUNT = '/indoorshop'

/**
 * 모듈 라우트를 이 앱의 마운트 지점(`/indoorshop/*`) 기준 상대 경로로 바꾼다.
 *
 * 동기화 스크립트가 module.ts 의 경로에 `/indoorshop` 을 붙여 두었다 —
 * `findProcessModuleByPath(location.pathname)` 이 절대 경로끼리 비교하기 때문이다.
 * 그런데 useRoutes 는 부모 라우트 아래의 **상대** 경로를 기대하므로 여기서 다시 뗀다.
 */
function toRelative(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    const path = route.path
    if (!path) return route
    if (!path.startsWith(MOUNT)) {
      throw new Error(`내업 라우트는 ${MOUNT} 아래여야 합니다 (sync-inshop.py 의 접두 변환 확인): ${path}`)
    }
    return { ...route, path: path.slice(MOUNT.length).replace(/^\//, '') }
  })
}

/** 화면 청크를 받는 동안의 자리 표시 — 레이아웃은 이미 떠 있으므로 본문만 채운다 */
function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={26} label={t('route.loading')} className="text-accent" />
    </div>
  )
}

/**
 * 내업 대시보드의 뿌리 — 셸 라우트 `indoorshop/*` 에 걸린다.
 *
 * 헤더·사이드바·푸터는 셸의 `AppLayout` 이 이미 그린다 — 원본의 `LayoutWrapper`
 * 를 그대로 쓰면 크롬이 두 겹으로 겹친다. 여기서는 원본 팔레트를 씌우는 스코프
 * (`inshop-root`)와, 셸에 없는 provider(글자 크기·고정 뷰포트), 그리고 원본
 * router.tsx 가 하던 라우트 조립만 남긴다.
 *
 * `inshop-root` 클래스가 필요한 이유: 원본 디자인 토큰은 `--background`
 * `--foreground` `--border` `--accent` 처럼 셸의 shadcn 토큰과 **이름이 같고 값이
 * 다르다**. `:root` 에 두면 다른 모듈 화면까지 이 팔레트로 칠해진다.
 */
export function InshopRoot() {
  return (
    <FontScaleProvider>
      <FixedViewportProvider>
        <InshopFrame />
      </FixedViewportProvider>
    </FontScaleProvider>
  )
}

/**
 * 본문 틀 — 원본 `LayoutWrapper` 의 `<main>` 에 해당한다.
 *
 * 기본은 문서형(본문이 길면 셸 ScrollArea 가 스크롤)이지만, 페이지가
 * `<FixedViewport />` 를 걸면 넓은 화면(xl)에서 본문을 뷰포트 높이에 **고정**하고
 * 스크롤은 각 패널 안으로 들어간다. 야드 지도·라이다 뷰어가 이 모드다.
 *
 * 이 고정이 없으면 그 화면들의 `xl:h-full` 사슬이 전부 `auto` 로 풀린다 —
 * 캔버스 컨테이너의 높이가 캔버스 자신의 크기에서 나오고, ResizeObserver 가
 * 그걸 다시 캔버스에 써 넣는 되먹임으로 지도가 수만 px 로 자라 화면 저 아래로
 * 밀려난다. 셸 ScrollArea 의 viewport 는 `size-full` 이라 `h-full` 이 여기서
 * 뷰포트 높이로 해석된다.
 */
function InshopFrame() {
  const fixed = useFixedViewport()
  const routes = useMemo<RouteObject[]>(
    () => [
      { index: true, Component: DashboardPage },
      ...toRelative(getProcessRoutes()),
      { path: 'performance', Component: PerformancePage },
      { path: 'docs', Component: DocsPage },
      { path: 'docs/:docId', Component: DocViewerPage },
      { path: 'settings', Component: SettingsPage },
      { path: '*', Component: NotFoundPage },
    ],
    [],
  )
  const element = useRoutes(routes)

  return (
    <div
      className={cn(
        'inshop-root min-h-full px-4 py-6 md:px-7 md:py-8',
        fixed && 'flex flex-col xl:h-full xl:min-h-0 xl:overflow-hidden xl:py-5',
      )}
    >
      {/*
        통합 검색(Cmd+K). 원본은 LayoutWrapper 에 한 번 마운트했다 — 그 크롬은
        셸 AppLayout 이 대신하므로 같은 역할의 이 뿌리에 한 번 마운트한다.
        (원본 헤더의 검색 버튼은 셸 공용 헤더라 옮기지 않는다 — 단축키로 연다.)
      */}
      <GlobalSearch />
      {/*
        첫 사용 투어(코치마크) — 원본은 LayoutWrapper 에 마운트. 앵커(data-tour)가
        셸 크롬에 있던 스텝(전역 검색 버튼·알람·사이드바 실적)은 스포트라이트 없이
        중앙 말풍선으로 뜬다(TourOverlay 의 결손 폴백). 재실행 버튼(?)은 원본 헤더
        것이라 없다 — 자동 1회 노출만 동작한다.
      */}
      <TourController />
      <Suspense fallback={<RouteFallback />}>{element}</Suspense>
    </div>
  )
}
