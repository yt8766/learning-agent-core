import { ExceptionPage } from './exception-page';

export function NotFoundPage() {
  return (
    <ExceptionPage
      actionText="返回首页"
      imageAlt="404 not found illustration"
      imageSrc="/pro-exception-assets/404.svg"
      status="404"
      subTitle="抱歉，您访问的页面不存在。"
    />
  );
}
