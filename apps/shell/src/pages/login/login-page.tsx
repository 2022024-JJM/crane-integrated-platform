import { useLoginForm } from './lib/use-login-form';
import { LoginBrandingPanel } from './ui/login-branding-panel';
import { LoginForm } from './ui/login-form';

const BG_URL = `${import.meta.env.BASE_URL}images/login-bg.jpg`;

/** 로그인 전용 키프레임 — 전역 CSS 오염 없이 페이지 안에서만 선언 */
const LOGIN_STYLES = `
@keyframes login-kenburns {
  0%   { transform: scale(1.01) translate(0, 0); }
  100% { transform: scale(1.06) translate(-0.8%, -1%); }
}
@keyframes login-rise {
  0%   { opacity: 0; transform: translateY(18px); filter: blur(6px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes login-fade {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes login-line-grow {
  0%   { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
@keyframes login-beacon {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
  50%      { opacity: 0.75; box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
}
.login-rise { animation: login-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
.login-fade { animation: login-fade 1.2s ease both; }
@media (prefers-reduced-motion: reduce) {
  .login-kenburns, .login-rise, .login-fade, .login-line, .login-beacon {
    animation: none !important;
  }
  .login-rise { opacity: 1; transform: none; filter: none; }
  .login-fade { opacity: 1; }
}
`;

function BackgroundScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 항공사진 — 천천히 확대되는 켄번즈 */}
      <img
        src={BG_URL}
        alt=""
        className="login-kenburns h-full w-full object-cover"
        style={{
          animation: 'login-kenburns 36s ease-in-out infinite alternate',
          filter: 'saturate(1.08) contrast(1.04) brightness(1.06)',
        }}
      />
      {/* 히어로 스크림 — 좌측만 짙게, 우측은 사진이 그대로 드러나도록 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(5,8,16,0.78) 0%, rgba(6,10,20,0.4) 42%, rgba(6,10,20,0.08) 68%, rgba(6,10,20,0.16) 100%)',
        }}
      />
      {/* 하단 비네트 — 푸터 가독성 확보 */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4"
        style={{
          background: 'linear-gradient(to top, rgba(4,7,16,0.45), transparent)',
        }}
      />
      {/* 상단 비네트 */}
      <div
        className="absolute inset-x-0 top-0 h-24"
        style={{
          background: 'linear-gradient(to bottom, rgba(4,7,16,0.4), transparent)',
        }}
      />
    </div>
  );
}

function TopBar() {
  return (
    <header
      className="login-rise relative z-10 flex items-center px-6 py-5 sm:px-10"
      style={{ animationDelay: '0.05s' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="login-beacon inline-block h-2 w-2 rounded-full bg-orange-500"
          style={{ animation: 'login-beacon 2.4s ease-in-out infinite' }}
        />
        <span
          className="text-[12px] font-semibold tracking-[0.26em] text-white/90 uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          CraneSP
        </span>
        <span
          className="hidden text-[12px] tracking-[0.26em] text-orange-400/80 uppercase sm:inline"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          / Integrated Platform
        </span>
      </div>
    </header>
  );
}

function FooterBar() {
  return (
    <footer
      className="login-fade relative z-10 flex items-center justify-between px-6 pt-4 pb-5 sm:px-10"
      style={{ animationDelay: '0.9s' }}
    >
      <p
        className="text-[11px] tracking-[0.14em] text-white/50"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        © Hanwha Energy · Convergence Division
      </p>
      <p
        className="hidden text-[11px] tracking-[0.18em] text-white/40 uppercase sm:block"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Authorized personnel only
      </p>
    </footer>
  );
}

export function LoginPage() {
  const form = useLoginForm();

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#060a16]">
      <style>{LOGIN_STYLES}</style>
      <BackgroundScene />

      <TopBar />

      <main className="relative z-10 flex flex-1 items-center px-6 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
          <LoginBrandingPanel />
          <LoginForm
            id={form.id}
            password={form.password}
            showPassword={form.showPassword}
            error={form.error}
            emptyId={form.emptyId}
            emptyPassword={form.emptyPassword}
            rememberId={form.rememberId}
            onIdChange={form.handleIdChange}
            onPasswordChange={form.handlePasswordChange}
            onToggleShowPassword={form.toggleShowPassword}
            onToggleRememberId={form.toggleRememberId}
            onSubmit={form.handleSubmit}
          />
        </div>
      </main>

      <FooterBar />
    </div>
  );
}
