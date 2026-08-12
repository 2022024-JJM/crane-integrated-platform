import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';

/**
 * 로그인 좌측 히어로 — 조선소 항공사진 위에 얹히는 계측기 톤 타이포그래피.
 * 아이브로우(모노)·헤드라인(콘덴스드)·서브(산스)로 서체를 분리해 위계를 만든다.
 * 모바일에서는 폼에 집중하도록 숨긴다.
 */
export function LoginBrandingPanel() {
  return (
    <section className="hidden flex-col lg:flex">
      {/* 아이브로우 — 한글은 모노에 글리프가 없어 산스로. 굵기·크기로 가독성 확보 */}
      <div
        className="login-rise flex items-center gap-3"
        style={{ animationDelay: '0.15s' }}
      >
        <HanwhaIcon width={32} height={32} />
        <span className="h-4 w-px bg-white/30" />
        <p
          className="text-[15px] leading-none font-semibold tracking-[0.01em] break-keep text-white/95"
          style={{ textShadow: '0 1px 10px rgba(0,0,0,0.85)' }}
        >
          한화에너지 컨버전스 사업부
        </p>
      </div>

      {/* 헤드라인 — 콘덴스드, 타이트한 행간으로 밀도를 준다 */}
      <h1
        className="login-rise mt-9 text-[clamp(2.75rem,4.6vw,4.25rem)] leading-[1.08] font-bold tracking-[-0.02em] break-keep text-white"
        style={{
          fontFamily: 'var(--font-condensed)',
          animationDelay: '0.28s',
          textShadow: '0 2px 24px rgba(0,0,0,0.5)',
        }}
      >
        현장을 연결하다,
        <br />
        운영을 바꾸다
      </h1>

      {/* 오렌지 인디케이터 바 — 헤드라인과 서브 사이의 리듬 */}
      <div
        className="login-line mt-8 h-[3px] w-16 origin-left rounded-full bg-orange-500"
        style={{
          animation: 'login-line-grow 0.8s 0.5s cubic-bezier(0.22,1,0.36,1) both',
          boxShadow: '0 0 20px rgba(249,115,22,0.6)',
        }}
      />

      <p
        className="login-rise mt-7 max-w-md text-[16px] leading-[1.75] break-keep text-white/80"
        style={{ animationDelay: '0.44s', textShadow: '0 1px 10px rgba(0,0,0,0.6)' }}
      >
        모니터링부터 자산·정비·운영까지, 하나의 흐름으로.
      </p>
    </section>
  );
}
