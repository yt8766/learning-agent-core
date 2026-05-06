import type { SVGProps } from 'react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminLoginForm } from '../components/admin-login-form';

export function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="mb-10 flex items-center gap-4 text-center">
        <AgentAdminLogo className="h-9 w-9" />
        <h1 className="text-4xl font-semibold tracking-normal max-sm:text-3xl">Agent 管理台</h1>
      </div>
      <Card className="w-full max-w-sm gap-4 rounded-2xl border-[#dbe3ef] px-6 py-7 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-semibold tracking-normal">登入</CardTitle>
          <CardDescription className="text-base leading-7 text-[#65738a]">
            请在下方输入您的账号和密码登录后台。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <AdminLoginForm />
        </CardContent>
        <CardFooter className="border-0 bg-transparent px-0 pt-2 pb-0">
          <p className="w-full px-6 text-center text-sm leading-7 text-[#65738a]">
            点击登录，即表示您同意我们的
            <a className="underline underline-offset-4 hover:text-foreground" href="/terms">
              服务条款
            </a>
            和
            <a className="underline underline-offset-4 hover:text-foreground" href="/privacy">
              隐私政策
            </a>
            。
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

function AgentAdminLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-labelledby="agent-admin-logo-title"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title id="agent-admin-logo-title">Agent 管理台标识</title>
      <path d="M12 3 19 7v10l-7 4-7-4V7z" />
      <path d="M12 8v8" />
      <path d="M8.5 10.5 12 8l3.5 2.5" />
      <path d="M8.5 13.5 12 16l3.5-2.5" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
