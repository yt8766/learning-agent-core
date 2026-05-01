import { mockDocuments, mockTraceDetail } from '../../api/mock-data';
import { DataCard, PageSection, styles } from '../shared/ui';

export function DocumentsPage() {
  return (
    <PageSection title="文档">
      {mockDocuments.map(document => (
        <DataCard key={document.id}>
          <div style={styles.row}>
            <strong>{document.title}</strong>
            <span style={styles.tag}>{document.status}</span>
          </div>
          <p style={styles.muted}>
            {document.filename} / Chunk {document.chunkCount} / 已向量化 {document.embeddedChunkCount}
          </p>
          <p>{mockTraceDetail.retrievalSnapshot?.selectedChunks[0]?.contentPreview}</p>
        </DataCard>
      ))}
    </PageSection>
  );
}
