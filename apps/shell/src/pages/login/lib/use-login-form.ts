import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@crane/features/auth';
import {
  currentScopeBaseUrl,
  type AppScope,
} from '@crane/core/config/app-scope';

const SAVED_ID_KEY = 'crane.login.saved-id';

const SCOPE_LABEL: Record<AppScope, string> = {
  crane: 'Crane',
  indoor: 'Indoor',
};

/** 아이디는 맞지만 이 주소의 계정이 아닐 때 안내 */
export interface ScopeDeniedNotice {
  message: string;
  /** 그 계정이 쓰는 주소. 범위를 나누지 않은 빌드면 null */
  href: string | null;
  linkLabel: string;
}

function scopeDeniedNotice(
  pageScope: AppScope | null,
  accountScope: AppScope,
): ScopeDeniedNotice {
  const page = pageScope ? SCOPE_LABEL[pageScope] : '';
  return {
    message: `이 주소는 ${page} 계정 전용입니다.`,
    href: currentScopeBaseUrl(accountScope),
    linkLabel: `${SCOPE_LABEL[accountScope]} 주소로 이동`,
  };
}

function readSavedId(): string {
  try {
    return window.localStorage.getItem(SAVED_ID_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSavedId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SAVED_ID_KEY, id);
    else window.localStorage.removeItem(SAVED_ID_KEY);
  } catch {
    // 저장 실패는 무시 — 로그인 자체에는 영향 없음
  }
}

export function useLoginForm() {
  const { login, scope } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState(readSavedId);
  const [rememberId, setRememberId] = useState(() => readSavedId() !== '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /** 제출 시 비어 있던 필드 안내 */
  const [emptyId, setEmptyId] = useState(false);
  const [emptyPassword, setEmptyPassword] = useState(false);
  /** 자격 증명 불일치 */
  const [error, setError] = useState(false);
  /** 다른 범위의 계정 */
  const [scopeDenied, setScopeDenied] = useState<ScopeDeniedNotice | null>(
    null,
  );

  function handleIdChange(value: string) {
    setId(value);
    setEmptyId(false);
    setError(false);
    setScopeDenied(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setEmptyPassword(false);
    setError(false);
    setScopeDenied(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missingId = id.trim() === '';
    const missingPassword = password === '';
    setEmptyId(missingId);
    setEmptyPassword(missingPassword);
    if (missingId || missingPassword) return;

    const result = login(id, password);
    if (result.ok) {
      const { role } = result.user;
      writeSavedId(rememberId ? id : null);
      const landing =
        role === 'mro'
          ? '/mro-dashboard'
          : role === 'mro2'
            ? '/mro2'
            : role === 'hmi'
              ? '/hmi'
              : role === 'hmi2'
                ? '/hmi2'
                : role === 'indoorshop'
                  ? '/indoorshop/gathering'
                  : role === 'indoorshop-ot'
                    ? '/indoorshop'
                    : role === 'keyin'
                      ? '/keyin'
                      : '/';
      navigate(landing, { replace: true });
    } else if (result.reason === 'scope-denied') {
      setScopeDenied(scopeDeniedNotice(scope, result.accountScope));
    } else {
      setError(true);
    }
  }

  return {
    id,
    password,
    showPassword,
    error,
    scopeDenied,
    emptyId,
    emptyPassword,
    rememberId,
    handleIdChange,
    handlePasswordChange,
    toggleShowPassword: () => setShowPassword((v) => !v),
    toggleRememberId: () => setRememberId((v) => !v),
    handleSubmit,
  };
}
