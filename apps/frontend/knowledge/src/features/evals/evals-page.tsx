import { mockEvalDatasets, mockEvalRuns } from '../../api/mock-data';
import { DataCard, PageSection, styles } from '../shared/ui';

export function EvalsPage() {
  return (
    <PageSection title="评测中心">
      <div style={styles.grid}>
        {mockEvalDatasets.map(dataset => (
          <DataCard key={dataset.id}>
            <strong>{dataset.name}</strong>
            <p style={styles.muted}>Case {dataset.caseCount}</p>
          </DataCard>
        ))}
        {mockEvalRuns.map(run => (
          <DataCard key={run.id}>
            <strong>运行 {run.id}</strong>
            <p style={styles.muted}>
              状态 {run.status} / 总分 {run.summary?.totalScore}
            </p>
          </DataCard>
        ))}
      </div>
    </PageSection>
  );
}
