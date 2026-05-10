import type { GatewaySnapshot } from '@agent/core';
import { describeGatewaySwitch, describeTokenStrategy } from '../gateway-view-model';

interface PipelinePageProps {
  config: GatewaySnapshot['config'];
}

const PIPELINE_STAGES = [
  { id: 'preprocess', label: 'Preprocess', detail: '规范化输入、估算输入 token、生成前置告警' },
  { id: 'route', label: 'Route', detail: '依据 provider 状态、优先级和请求模型选择上游方' },
  { id: 'relay', label: 'Relay', detail: '通过稳定 relay contract 调用上游 provider adapter' },
  { id: 'accounting', label: 'Accounting', detail: '记录日志、累计用量、保留审计证据' }
];

export function PipelinePage({ config }: PipelinePageProps) {
  return (
    <section className="page-stack" aria-label="调用管线">
      <div className="section-heading">
        <h2>调用管线</h2>
        <p>
          输入 {describeTokenStrategy(config.inputTokenStrategy)}，输出{' '}
          {describeTokenStrategy(config.outputTokenStrategy)}， 重试 {config.retryLimit} 次。
        </p>
      </div>
      <div className="pipeline-list">
        {PIPELINE_STAGES.map((stage, index) => (
          <article className="pipeline-stage" key={stage.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{stage.label}</h3>
              <p>{stage.detail}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="config-strip">
        <span>熔断：{describeGatewaySwitch(config.circuitBreakerEnabled)}</span>
        <span>审计：{describeGatewaySwitch(config.auditEnabled)}</span>
      </div>
    </section>
  );
}
