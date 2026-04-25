'use client';

import { FormEvent, useState } from 'react';

import { AdminClientAuthError, loginAdmin } from '../auth/admin-client-auth';

export function AdminLoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');

    try {
      await loginAdmin({ password });
      window.location.assign('/admin');
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={handleSubmit}>
      <label htmlFor="admin-password">管理员密码</label>
      <input
        autoComplete="current-password"
        id="admin-password"
        name="password"
        placeholder="输入后台密码"
        required
        type="password"
      />
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof AdminClientAuthError && error.code === 'admin_auth_not_configured') {
    return '尚未设置管理员密码，请先在环境变量中配置真实的 LLM_GATEWAY_BOOTSTRAP_ADMIN_PASSWORD 和 LLM_GATEWAY_ADMIN_JWT_SECRET。';
  }

  return '登录失败，请检查密码后重试。';
}
