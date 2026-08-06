import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@crane/features/auth';

const SAVED_ID_KEY = 'crane.login.saved-id';

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
  const { login } = useAuth();
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

  function handleIdChange(value: string) {
    setId(value);
    setEmptyId(false);
    setError(false);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setEmptyPassword(false);
    setError(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missingId = id.trim() === '';
    const missingPassword = password === '';
    setEmptyId(missingId);
    setEmptyPassword(missingPassword);
    if (missingId || missingPassword) return;

    const role = login(id, password);
    if (role) {
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
                : '/';
      navigate(landing, { replace: true });
    } else {
      setError(true);
    }
  }

  return {
    id,
    password,
    showPassword,
    error,
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
