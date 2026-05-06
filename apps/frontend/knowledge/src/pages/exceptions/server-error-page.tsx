import { ExceptionPage } from './exception-page';

export function ServerErrorPage() {
  return (
    <ExceptionPage
      actionText="Back Home"
      imageAlt="500 server error illustration"
      imageSrc="/pro-exception-assets/500.svg"
      status="500"
      subTitle="Sorry, something went wrong."
    />
  );
}
