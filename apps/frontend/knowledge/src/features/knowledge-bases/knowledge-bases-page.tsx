import { mockKnowledgeBases } from '../../api/mock-data';
import { DataCard, PageSection, styles } from '../shared/ui';

export function KnowledgeBasesPage() {
  return (
    <PageSection title="知识库">
      {mockKnowledgeBases.map(kb => (
        <DataCard key={kb.id}>
          <div style={styles.row}>
            <strong>{kb.name}</strong>
            <span style={styles.tag}>{kb.status}</span>
          </div>
          <p style={styles.muted}>
            文档 {kb.documentCount} / Chunk {kb.chunkCount} / 最新评测 {kb.latestEvalScore}
          </p>
          <p style={styles.muted}>{kb.tags.join(', ')}</p>
        </DataCard>
      ))}
    </PageSection>
  );
}
