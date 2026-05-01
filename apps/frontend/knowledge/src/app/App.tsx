import { useState } from 'react';

import { AppShell, type KnowledgeView } from './layout/app-shell';
import { ProtectedRoute } from './protected-route';
import { AuthProvider, useAuth } from '../features/auth/auth-provider';
import { ChatLabPage } from '../features/chat-lab/chat-lab-page';
import { DocumentsPage } from '../features/documents/documents-page';
import { EvalsPage } from '../features/evals/evals-page';
import { KnowledgeBasesPage } from '../features/knowledge-bases/knowledge-bases-page';
import { ObservabilityPage } from '../features/observability/observability-page';
import { OverviewPage } from '../features/overview/overview-page';
import { SettingsPage } from '../features/settings/settings-page';

export function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <KnowledgeWorkspace />
      </ProtectedRoute>
    </AuthProvider>
  );
}

function KnowledgeWorkspace() {
  const { logout } = useAuth();
  const [activeView, setActiveView] = useState<KnowledgeView>('overview');
  return (
    <AppShell activeView={activeView} onLogout={logout} onNavigate={setActiveView}>
      {renderView(activeView)}
    </AppShell>
  );
}

function renderView(view: KnowledgeView) {
  switch (view) {
    case 'knowledgeBases':
      return <KnowledgeBasesPage />;
    case 'documents':
      return <DocumentsPage />;
    case 'chatLab':
      return <ChatLabPage />;
    case 'observability':
      return <ObservabilityPage />;
    case 'evals':
      return <EvalsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'overview':
    default:
      return <OverviewPage />;
  }
}
