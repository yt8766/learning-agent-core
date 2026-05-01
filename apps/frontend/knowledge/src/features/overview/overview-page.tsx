import { mockDashboard } from '../../api/mock-data';
import { Metric, PageSection, styles } from '../shared/ui';

export function OverviewPage() {
  return (
    <PageSection title="总览">
      <div style={styles.grid}>
        <Metric label="知识库" value={mockDashboard.knowledgeBaseCount} />
        <Metric label="文档" value={mockDashboard.documentCount} />
        <Metric label="今日问答" value={mockDashboard.todayQuestionCount} />
        <Metric label="P95" value={`${mockDashboard.p95LatencyMs}ms`} />
      </div>
      <div style={styles.grid}>
        <Metric label="最新评测分" value={mockDashboard.latestEvalScore ?? '-'} />
        <Metric label="负反馈率" value={`${Math.round((mockDashboard.negativeFeedbackRate ?? 0) * 100)}%`} />
        <Metric label="错误率" value={`${Math.round((mockDashboard.errorRate ?? 0) * 100)}%`} />
        <Metric label="活跃告警" value={mockDashboard.activeAlertCount} />
      </div>
    </PageSection>
  );
}
