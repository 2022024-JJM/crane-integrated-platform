import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@crane/features/auth';

export function useLoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  function handleIdChange(value: string) {
    setId(value);
    setError(false);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setError(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const role = login(id, password);
    if (role) {
      navigate(role === 'mro' ? '/mro-dashboard' : '/', { replace: true });
    } else {
      setError(true);
    }
  }

  return {
    id,
    password,
    showPassword,
    error,
    handleIdChange,
    handlePasswordChange,
    toggleShowPassword: () => setShowPassword((v) => !v),
    handleSubmit,
  };
}
