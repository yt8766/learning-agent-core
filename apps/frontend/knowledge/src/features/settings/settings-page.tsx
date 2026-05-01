import { DataCard, PageSection, styles } from '../shared/ui';

export function SettingsPage() {
  return (
    <PageSection title="设置">
      <DataCard>
        <strong>默认向量库</strong>
        <p style={styles.muted}>Supabase PostgreSQL + pgvector</p>
      </DataCard>
      <DataCard>
        <strong>SDK Core</strong>
        <p style={styles.muted}>使用方可实现 EmbeddingProvider 与 VectorStore 接口替换默认实现。</p>
      </DataCard>
    </PageSection>
  );
}
