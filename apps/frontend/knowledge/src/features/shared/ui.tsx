import type { ReactNode } from 'react';

export function PageSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.title}>{title}</h2>
      {children}
    </section>
  );
}

export function DataCard({ children }: { children: ReactNode }) {
  return <article style={styles.card}>{children}</article>;
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <DataCard>
      <p style={styles.label}>{label}</p>
      <strong style={styles.value}>{value}</strong>
    </DataCard>
  );
}

export const styles = {
  section: { display: 'grid', gap: 16 },
  title: { fontSize: 24, letterSpacing: 0, margin: 0 },
  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' },
  card: { background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: 8, display: 'grid', gap: 8, padding: 16 },
  label: { color: '#667085', fontSize: 13, margin: 0 },
  value: { color: '#101828', fontSize: 22 },
  row: { alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between' },
  table: {
    background: '#ffffff',
    border: '1px solid #d0d5dd',
    borderCollapse: 'collapse',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%'
  },
  cell: { borderBottom: '1px solid #eaecf0', fontSize: 14, padding: 12, textAlign: 'left' },
  muted: { color: '#667085', fontSize: 13, margin: 0 },
  tag: { background: '#eef4ff', borderRadius: 999, color: '#175cd3', fontSize: 12, padding: '4px 8px' }
} as const;
