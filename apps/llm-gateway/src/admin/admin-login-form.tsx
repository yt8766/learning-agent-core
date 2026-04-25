'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { AdminClientAuthError, loginAdmin } from '../auth/admin-client-auth';
import { Button } from '../components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../components/ui/field';
import { Input } from '../components/ui/input';

export function AdminLoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await loginAdmin({ username, password });
      window.location.assign('/admin');
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form autoComplete="off" onSubmit={handleSubmit}>
      <FieldGroup className="gap-9">
        <Field className="gap-5">
          <FieldLabel className="text-[22px] font-medium" htmlFor="admin-account">
            管理员账号
          </FieldLabel>
          <Input
            aria-describedby="admin-account-description"
            autoComplete="off"
            className="h-14 rounded-xl border-[#dedede] px-6 text-[22px] shadow-sm placeholder:text-[#737373]"
            id="admin-account"
            name="adminAccount"
            onChange={event => setUsername(event.currentTarget.value)}
            required
            placeholder="请输入管理员账号"
            type="text"
            value={username}
          />
          <FieldDescription id="admin-account-description">默认账号 admin</FieldDescription>
        </Field>
        <Field className="gap-5">
          <div className="flex items-center gap-3">
            <FieldLabel className="text-[22px] font-medium" htmlFor="admin-password">
              管理员密码
            </FieldLabel>
          </div>
          <div className="relative">
            <Input
              aria-describedby="admin-password-description"
              autoComplete="new-password"
              className="h-14 rounded-xl border-[#dedede] px-6 pr-14 text-[22px] shadow-sm placeholder:text-[#737373]"
              id="admin-password"
              name="password"
              onChange={event => setPassword(event.currentTarget.value)}
              placeholder="输入管理员密码"
              required
              type={isPasswordVisible ? 'text' : 'password'}
              value={password}
            />
            <Button
              aria-label={isPasswordVisible ? '隐藏密码' : '显示密码'}
              className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-lg text-[#737373] hover:text-[#171717]"
              onClick={() => setIsPasswordVisible(current => !current)}
              size="icon"
              type="button"
              variant="ghost"
            >
              {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <FieldDescription id="admin-password-description">使用部署时配置的管理员密码</FieldDescription>
        </Field>
        <Field className="gap-5">
          {errorMessage ? <p className="m-0 text-sm text-destructive">{errorMessage}</p> : null}
          <Button
            className="h-14 w-full rounded-xl bg-[#171717] text-[22px] font-medium text-white hover:bg-[#242424]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '登录中...' : '登录'}
          </Button>
          <FieldDescription className="text-center text-[22px] leading-7">
            此后台不开放注册，账号由部署初始化配置。
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof AdminClientAuthError && error.code === 'admin_auth_not_configured') {
    return '后台认证尚未完成初始化，请联系部署管理员检查环境配置。';
  }

  return '账号或密码不正确，请检查后重试。';
}
