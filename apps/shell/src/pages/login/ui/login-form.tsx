import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';

interface LoginFormProps {
  id: string;
  password: string;
  showPassword: boolean;
  error: boolean;
  onIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function LoginForm({
  id,
  password,
  showPassword,
  error,
  onIdChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
}: LoginFormProps) {
  const [focusedField, setFocusedField] = useState<'id' | 'password' | null>(null);

  return (
    <div className="flex flex-1 flex-col justify-center px-10 py-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium tracking-widest text-white/30 uppercase">
          Welcome back
        </p>
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">ID</label>
          <input
            type="text"
            placeholder="crane.ocean"
            value={id}
            autoComplete="username"
            onChange={(e) => onIdChange(e.target.value)}
            onFocus={() => setFocusedField('id')}
            onBlur={() => setFocusedField(null)}
            className={cn(
              'w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20',
              focusedField === 'id'
                ? 'border border-orange-500/60 bg-white/8'
                : 'border border-white/8 bg-white/6',
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => onPasswordChange(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                'w-full rounded-xl px-4 py-3 pr-11 text-sm text-white outline-none transition-all placeholder:text-white/20',
                focusedField === 'password'
                  ? 'border border-orange-500/60 bg-white/8'
                  : 'border border-white/8 bg-white/6',
              )}
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            ID 또는 비밀번호가 올바르지 않습니다.
          </div>
        )}

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-linear-to-br from-orange-500 to-orange-600 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)] transition-all hover:shadow-[0_4px_28px_rgba(249,115,22,0.5)] active:scale-[0.98]"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
