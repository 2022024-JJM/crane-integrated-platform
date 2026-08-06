import { useState } from 'react';
import { Eye, EyeOff, X, ChevronRight, Check } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';

interface LoginFormProps {
  id: string;
  password: string;
  showPassword: boolean;
  error: boolean;
  emptyId: boolean;
  emptyPassword: boolean;
  rememberId: boolean;
  onIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleRememberId: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const UNDERLINE_INPUT =
  'w-full border-0 border-b bg-transparent px-0.5 pb-2.5 pt-1.5 text-[15px] text-white outline-none transition-colors duration-200 placeholder:text-white/35';

/** 인풋 위 모노 캡션 라벨 — 계기 패널 톤 */
const FIELD_LABEL =
  'mb-1.5 block text-[10px] leading-none tracking-[0.2em] uppercase transition-colors duration-200';

export function LoginForm({
  id,
  password,
  showPassword,
  error,
  emptyId,
  emptyPassword,
  rememberId,
  onIdChange,
  onPasswordChange,
  onToggleShowPassword,
  onToggleRememberId,
  onSubmit,
}: LoginFormProps) {
  const [focusedField, setFocusedField] = useState<'id' | 'password' | null>(null);
  const [showResetHint, setShowResetHint] = useState(false);

  return (
    <div
      className="login-rise relative mx-auto w-full max-w-110"
      style={{ animationDelay: '0.35s' }}
    >
      <div
        className="relative overflow-hidden rounded-lg px-8 py-9 sm:px-9"
        style={{
          /* 사진 위에서 갈색으로 물들지 않도록 충분히 어둡고 차가운 베이스 */
          background:
            'linear-gradient(165deg, rgba(9,13,22,0.93) 0%, rgba(6,9,16,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow:
            '0 32px 80px -12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px) saturate(0.6)',
        }}
      >
        {/* 상단 오렌지 헤어라인 — 카드를 계기 패널처럼 마감 */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(249,115,22,0.9) 30%, rgba(249,115,22,0.9) 70%, transparent)',
          }}
        />

        {/* 폼 헤더 — 모노 라벨 + 콘덴스드 제목 */}
        <div className="mb-9">
          <p
            className="text-[10px] leading-none tracking-[0.28em] text-orange-400/90 uppercase"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Secure Access
          </p>
          <h2
            className="mt-3 text-[26px] leading-none font-bold tracking-[-0.01em] text-white"
            style={{ fontFamily: 'var(--font-condensed)' }}
          >
            로그인
          </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col">
          {/* ID — 언더라인 인풋 + 클리어 버튼 */}
          <div className="relative">
            <label
              htmlFor="login-id"
              className={cn(
                FIELD_LABEL,
                focusedField === 'id' ? 'text-orange-400' : 'text-white/45',
              )}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              ID
            </label>
            <input
              id="login-id"
              type="text"
              placeholder="아이디를 입력하세요"
              value={id}
              autoComplete="username"
              onChange={(e) => onIdChange(e.target.value)}
              onFocus={() => setFocusedField('id')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                UNDERLINE_INPUT,
                'pr-9',
                focusedField === 'id' ? 'border-orange-500' : 'border-white/40',
              )}
            />
            {id !== '' && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="아이디 지우기"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onIdChange('')}
                className="absolute right-0.5 bottom-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/60 text-slate-900 transition-colors hover:bg-white"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            )}
          </div>
          {emptyId && (
            <p className="mt-2 text-[12px] font-medium text-white">
              아이디를 입력하세요.
            </p>
          )}

          {/* Password — 언더라인 인풋 + 표시 토글 */}
          <div className="relative mt-6">
            <label
              htmlFor="login-password"
              className={cn(
                FIELD_LABEL,
                focusedField === 'password' ? 'text-orange-400' : 'text-white/45',
              )}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Password
            </label>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호를 입력하세요"
              value={password}
              autoComplete="current-password"
              onChange={(e) => onPasswordChange(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                UNDERLINE_INPUT,
                'pr-9',
                focusedField === 'password' ? 'border-orange-500' : 'border-white/40',
              )}
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              className="absolute right-0.5 bottom-2.5 text-white/45 transition-colors hover:text-white/90"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {emptyPassword && (
            <p className="mt-2 text-[12px] font-medium text-white">
              비밀번호를 입력해 주세요
            </p>
          )}

          {/* 자격 증명 불일치 */}
          {error && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-orange-300">
              아이디 또는 비밀번호가 올바르지 않습니다.
            </p>
          )}

          {/* 아이디 저장 · 비밀번호 재발급 */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onToggleRememberId}
              className="group flex items-center gap-2.5"
              role="checkbox"
              aria-checked={rememberId}
              aria-label="아이디 저장"
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-[3px] border transition-all duration-200',
                  rememberId
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-white/35 bg-transparent group-hover:border-white/60',
                )}
              >
                <Check
                  className={cn(
                    'h-2.5 w-2.5 transition-opacity',
                    rememberId ? 'text-white opacity-100' : 'opacity-0',
                  )}
                  strokeWidth={3.5}
                />
              </span>
              <span className="text-[13px] text-white/75">아이디 저장</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowResetHint((v) => !v)}
                className="flex items-center gap-0.5 text-[13px] text-white/75 transition-colors hover:text-orange-300"
              >
                비밀번호 재발급
                <ChevronRight className="h-4 w-4" />
              </button>
              {showResetHint && (
                <p className="absolute top-full right-0 z-10 mt-1.5 rounded-md bg-black/80 px-3 py-1.5 text-[12px] whitespace-nowrap text-white/80">
                  시스템 관리자에게 문의해 주세요
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="mt-8 w-full rounded-md bg-orange-500 py-3.5 text-[15px] font-semibold tracking-[0.02em] text-white shadow-[0_8px_28px_-6px_rgba(249,115,22,0.5)] transition-all duration-200 hover:bg-orange-400 hover:shadow-[0_10px_34px_-6px_rgba(249,115,22,0.65)] active:scale-[0.99]"
          >
            로그인
          </button>

          {/* 하단 시스템 라벨 — 계기 패널 마감 */}
          <p
            className="mt-6 text-center text-[10px] tracking-[0.18em] text-white/25 uppercase"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Crane Integrated Platform · v1.0
          </p>
        </form>
      </div>
    </div>
  );
}
