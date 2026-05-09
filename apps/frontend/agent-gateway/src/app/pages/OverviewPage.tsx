import type { GatewaySnapshot } from '@agent/core';
import { GatewayMetric } from '../components/GatewayMetric';
import {
  describeGatewaySwitch,
  describeRuntimeStatus,
  describeTokenStrategy,
  formatGatewayDate
} from '../gateway-view-model';

interface OverviewPageProps {
  snapshot: GatewaySnapshot;
  logCount: number;
  usageCount: number;
}

export function OverviewPage({ snapshot, logCount, usageCount }: OverviewPageProps) {
  return (
    <section className="page-stack" aria-label="总览">
      <div className="section-heading">
        <h2>总览</h2>
        <p>观测时间 {formatGatewayDate(snapshot.observedAt)}</p>
      </div>
      <div className="metric-grid">
        <GatewayMetric
          label="运行状态"
          value={describeRuntimeStatus(snapshot.runtime)}
          detail={snapshot.runtime.mode}
        />
        <GatewayMetric
          label="活跃上游"
          value={snapshot.runtime.activeProviderCount}
          detail={`降级 ${snapshot.runtime.degradedProviderCount}`}
        />
        <GatewayMetric
          label="主上游"
          value={snapshot.providerCredentialSets[0]?.provider ?? '-'}
          detail={snapshot.providerCredentialSets[0]?.id ?? '未配置'}
        />
        <GatewayMetric label="RPM" value={snapshot.runtime.requestPerMinute} detail="最近窗口" />
        <GatewayMetric label="P95 延迟" value={`${snapshot.runtime.p95LatencyMs}ms`} detail="端到端" />
        <GatewayMetric label="输入 token" value={describeTokenStrategy(snapshot.config.inputTokenStrategy)} />
        <GatewayMetric label="输出 token" value={describeTokenStrategy(snapshot.config.outputTokenStrategy)} />
        <GatewayMetric label="重试上限" value={snapshot.config.retryLimit} />
        <GatewayMetric
          label="审计 / 熔断"
          value={`${describeGatewaySwitch(snapshot.config.auditEnabled)} / ${describeGatewaySwitch(snapshot.config.circuitBreakerEnabled)}`}
          detail={`日志 ${logCount} 条，用量 ${usageCount} 条`}
        />
      </div>
    </section>
  );
}
