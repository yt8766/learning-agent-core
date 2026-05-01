import type { ReactNode } from 'react';

export type KnowledgeView =
  | 'overview'
  | 'knowledgeBases'
  | 'documents'
  | 'chatLab'
  | 'observability'
  | 'evals'
  | 'settings';

const navItems: Array<{ id: KnowledgeView; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'knowledgeBases', label: '知识库' },
  { id: 'documents', label: '文档' },
  { id: 'chatLab', label: '对话实验室' },
  { id: 'observability', label: '观测中心' },
  { id: 'evals', label: '评测中心' },
  { id: 'settings', label: '设置' }
];

export function AppShell({
  activeView,
  children,
  onLogout,
  onNavigate
}: {
  activeView: KnowledgeView;
  children: ReactNode;
  onLogout: () => void;
  onNavigate: (view: KnowledgeView) => void;
}) {
  return (
    <div style={styles.frame}>
      <aside style={styles.sidebar}>
        <div>
          <p style={styles.eyebrow}>RAG Workspace</p>
          <h1 style={styles.brand}>Knowledge</h1>
        </div>
        <nav style={styles.nav}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                ...styles.navButton,
                ...(activeView === item.id ? styles.navButtonActive : {})
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} style={styles.logoutButton} type="button">
          退出登录
        </button>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  frame: {
    background: '#f5f7fb',
    color: '#172033',
    display: 'grid',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    gridTemplateColumns: '240px minmax(0, 1fr)',
    minHeight: '100vh'
  },
  sidebar: {
    alignContent: 'start',
    background: '#101828',
    color: '#f8fafc',
    display: 'grid',
    gap: 24,
    padding: 20
  },
  eyebrow: { color: '#98a2b3', fontSize: 12, margin: 0 },
  brand: { fontSize: 24, letterSpacing: 0, margin: '4px 0 0' },
  nav: { display: 'grid', gap: 8 },
  navButton: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: 14,
    padding: '10px 12px',
    textAlign: 'left'
  },
  navButtonActive: {
    background: '#1d2939',
    borderColor: '#344054',
    color: '#ffffff'
  },
  logoutButton: {
    alignSelf: 'end',
    background: '#ffffff',
    border: 0,
    borderRadius: 8,
    color: '#101828',
    cursor: 'pointer',
    fontSize: 14,
    padding: '10px 12px'
  },
  main: {
    display: 'grid',
    gap: 20,
    padding: 24
  }
} as const;
