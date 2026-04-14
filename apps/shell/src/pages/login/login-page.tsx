import { useLoginForm } from './lib/use-login-form';
import { LoginBrandingPanel } from './ui/login-branding-panel';
import { LoginForm } from './ui/login-form';

export function LoginPage() {
  const form = useLoginForm();

  return (
    <div
      className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f1117 0%, #1a1f2e 40%, #0f1117 100%)',
      }}
    >
      {/* 배경 블러 오브 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-20 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
      </div>

      {/* 카드 */}
      <div
        className="relative flex w-full max-w-215 overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <LoginBrandingPanel />
        <LoginForm
          id={form.id}
          password={form.password}
          showPassword={form.showPassword}
          error={form.error}
          onIdChange={form.handleIdChange}
          onPasswordChange={form.handlePasswordChange}
          onToggleShowPassword={form.toggleShowPassword}
          onSubmit={form.handleSubmit}
        />
      </div>
    </div>
  );
}
