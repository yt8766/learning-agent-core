import { Button, Typography } from 'antd';

export type ExceptionStatus = '403' | '404' | '500';

type ExceptionPreset = {
  actionText: string;
  imageAlt: string;
  imageSrc: string;
  subTitle: string;
};

const exceptionPresets: Record<ExceptionStatus, ExceptionPreset> = {
  '403': {
    actionText: 'Back to home',
    imageAlt: '403 forbidden illustration',
    imageSrc: '/pro-exception-assets/403.svg',
    subTitle: 'Sorry, you are not authorized to access this page.'
  },
  '404': {
    actionText: '返回首页',
    imageAlt: '404 not found illustration',
    imageSrc: '/pro-exception-assets/404.svg',
    subTitle: '抱歉，您访问的页面不存在。'
  },
  '500': {
    actionText: 'Back Home',
    imageAlt: '500 server error illustration',
    imageSrc: '/pro-exception-assets/500.svg',
    subTitle: 'Sorry, something went wrong.'
  }
};

export type ExceptionPageProps = {
  homeHref?: string;
} & (
  | ({
      status: ExceptionStatus;
      type?: never;
    } & ExceptionPreset)
  | ({
      type: ExceptionStatus;
      status?: never;
    } & Partial<ExceptionPreset>)
);

export function ExceptionPage(props: ExceptionPageProps) {
  const status = props.status ?? props.type;
  const preset = exceptionPresets[status];
  const actionText = props.actionText ?? preset.actionText;
  const homeHref = props.homeHref ?? '/';
  const imageAlt = props.imageAlt ?? preset.imageAlt;
  const imageSrc = props.imageSrc ?? preset.imageSrc;
  const subTitle = props.subTitle ?? preset.subTitle;

  return (
    <main className="knowledge-pro-exception" data-status={status}>
      <div className="knowledge-pro-exception-visual" aria-hidden="true">
        <img alt={imageAlt} className="knowledge-pro-exception-image" src={imageSrc} />
      </div>
      <section className="knowledge-pro-exception-content" aria-labelledby={`knowledge-exception-${status}`}>
        <Typography.Title className="knowledge-pro-exception-title" id={`knowledge-exception-${status}`} level={1}>
          {status}
        </Typography.Title>
        <Typography.Paragraph className="knowledge-pro-exception-subtitle">{subTitle}</Typography.Paragraph>
        <Button href={homeHref} type="primary">
          {actionText}
        </Button>
      </section>
    </main>
  );
}
