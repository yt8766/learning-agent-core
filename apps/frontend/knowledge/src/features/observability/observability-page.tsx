import { mockTraceDetail } from '../../api/mock-data';
import { DataCard, Metric, PageSection, styles } from '../shared/ui';

export function ObservabilityPage() {
  return (
    <PageSection title="观测中心">
      <div style={styles.grid}>
        <Metric label="Trace 数" value={1} />
        <Metric label="平均延迟" value={`${mockTraceDetail.latencyMs}ms`} />
        <Metric label="命中数" value={mockTraceDetail.hitCount ?? 0} />
        <Metric label="引用数" value={mockTraceDetail.citationCount ?? 0} />
      </div>
      <DataCard>
        <strong>{mockTraceDetail.question}</strong>
        <p>{mockTraceDetail.answer}</p>
        {mockTraceDetail.spans.map(span => (
          <div key={span.id} style={styles.row}>
            <span>{span.name}</span>
            <span style={styles.muted}>{span.latencyMs}ms</span>
          </div>
        ))}
      </DataCard>
    </PageSection>
  );
}
