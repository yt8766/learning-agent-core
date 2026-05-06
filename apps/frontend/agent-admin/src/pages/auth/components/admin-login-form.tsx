import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAdminAuth } from '../api/admin-auth.api';
import { adminAuthStore } from '../store/admin-auth-store';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: '账号或密码错误',
  account_disabled: '账号已停用，请联系管理员',
  account_locked: '账号已锁定，请稍后再试'
};

export function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    adminAuthStore.setAuthenticating();

    try {
      const response = await loginAdminAuth({ username, password, remember });
      adminAuthStore.setAuthenticated(response.account, response.tokens, { persist: remember });
    } catch (loginError) {
      adminAuthStore.clear('anonymous');
      setError(resolveLoginErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-base font-semibold">
        账号
        <Input
          autoComplete="username"
          className="h-12 rounded-xl border-[#dbe3ef] px-4 text-base shadow-sm placeholder:text-[#65738a] focus:border-[#c9d3e2] focus:ring-[#dbe3ef]"
          name="username"
          placeholder="请输入账号"
          value={username}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setUsername(event.target.value)}
        />
      </label>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-base font-semibold" htmlFor="admin-password">
            密码
          </label>
          <button
            className="text-sm font-semibold text-[#65738a] transition hover:text-foreground"
            type="button"
            onClick={() => setShowPassword(current => !current)}
          >
            {showPassword ? '隐藏密码' : '显示密码'}
          </button>
        </div>
        <div className="relative">
          <Input
            autoComplete="current-password"
            className="h-12 rounded-xl border-[#dbe3ef] px-4 pr-12 text-base shadow-sm placeholder:text-[#65738a] focus:border-[#c9d3e2] focus:ring-[#dbe3ef]"
            id="admin-password"
            name="password"
            placeholder="请输入密码"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
          />
          <button
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            className="absolute inset-y-0 right-3 flex items-center text-[#65738a] transition hover:text-foreground"
            type="button"
            onClick={() => setShowPassword(current => !current)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#65738a]">
        <input
          checked={remember}
          className="h-4 w-4"
          type="checkbox"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRemember(event.target.checked)}
        />
        记住登录
      </label>
      {error ? <p className="text-sm text-[#b3402e]">{error}</p> : null}
      <Button
        className="mt-2 h-12 w-full rounded-xl bg-[#0f172a] text-base font-semibold hover:bg-[#111827]"
        type="submit"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
        {isSubmitting ? '登录中...' : '登入'}
      </Button>
    </form>
  );
}

function resolveLoginErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    for (const [code, message] of Object.entries(AUTH_ERROR_MESSAGES)) {
      if (error.message.includes(code)) {
        return message;
      }
    }
  }
  return '账号或密码错误';
}
