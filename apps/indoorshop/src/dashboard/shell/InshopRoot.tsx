import { Outlet } from 'react-router-dom'
import { FixedViewportProvider } from '../shared/lib/fixed-viewport/FixedViewportProvider'
import { useFixedViewport } from '../shared/lib/fixed-viewport/useFixedViewport'
import { FontScaleProvider } from '../shared/lib/font-scale/FontScaleProvider'
import { registerInshopLocales } from '../shared/lib/i18n/config'
import { cn } from '../shared/lib/utils'

/*
 * 서체는 npm 패키지로 번들한다 — OT망에서는 외부 CDN(Google Fonts 등)에 나가지 못한다.
 * dynamic-subset 은 한글 글리프를 청크로 쪼개 실제로 쓰인 것만 받는다.
 * (IBM Plex Mono 는 셸 global.css 가 이미 싣고 있어 여기서 또 부르지 않는다.)
 */
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'

/*
 * 번역 번들은 컴포넌트 밖에서 한 번만 등록한다 — 첫 렌더가 이미 번역된 문구로
 * 나와야 화면이 한 번 깜박이며 언어가 바뀌는 일이 없다.
 */
registerInshopLocales()

/**
 * 내업 대시보드의 뿌리.
 *
 * 헤더·사이드바·푸터는 셸의 `AppLayout` 이 이미 그린다 — 원본의 `LayoutWrapper`
 * 를 그대로 쓰면 크롬이 두 겹으로 겹친다. 여기서는 원본 팔레트를 씌우는 스코프
 * (`inshop-root`)와, 셸에 없는 provider(글자 크기·고정 뷰포트)만 남긴다.
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

  return (
    <div
      className={cn(
        'inshop-root min-h-full px-4 py-6 md:px-7 md:py-8',
        fixed && 'flex flex-col xl:h-full xl:min-h-0 xl:overflow-hidden xl:py-5',
      )}
    >
      <Outlet />
    </div>
  )
}
