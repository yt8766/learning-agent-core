import { AdminLoginForm } from '../../../src/admin/admin-login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../src/components/ui/card';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-[640px] rounded-[20px] border-[#e0e0e0] p-12 shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
        <CardHeader className="gap-3 p-0 pb-10">
          <CardTitle className="text-[24px] font-semibold leading-tight">登录到管理员账号</CardTitle>
          <CardDescription className="text-[22px] leading-8 text-[#737373]">
            输入管理员账号和密码进入私有网关控制台
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <AdminLoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
