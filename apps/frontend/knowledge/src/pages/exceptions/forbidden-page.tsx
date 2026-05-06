import { ExceptionPage } from './exception-page';

export function ForbiddenPage() {
  return (
    <ExceptionPage
      actionText="Back to home"
      imageAlt="403 forbidden illustration"
      imageSrc="/pro-exception-assets/403.svg"
      status="403"
      subTitle="Sorry, you are not authorized to access this page."
    />
  );
}
