import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tailwind.css';
import 'antd/dist/reset.css';
import '@xyflow/react/dist/style.css';
import './styles/knowledge-pro.css';
import './styles/knowledge-rag-ops.css';

import { AuthClient } from './api/auth-client';
import { KnowledgeApiClient } from './api/knowledge-api-client';
import { KnowledgeApiProvider, type KnowledgeFrontendApi } from './api/knowledge-api-provider';
import { MockKnowledgeApiClient } from './api/mock-knowledge-api-client';
import { App } from './app/App';

const authServiceBaseUrl = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const knowledgeServiceBaseUrl = import.meta.env.VITE_KNOWLEDGE_SERVICE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const authClient = new AuthClient({ baseUrl: authServiceBaseUrl });
const knowledgeApiClient: KnowledgeFrontendApi =
  import.meta.env.VITE_KNOWLEDGE_API_MODE === 'mock'
    ? new MockKnowledgeApiClient()
    : new KnowledgeApiClient({
        baseUrl: knowledgeServiceBaseUrl,
        authClient
      });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KnowledgeApiProvider client={knowledgeApiClient}>
      <App authClient={authClient} />
    </KnowledgeApiProvider>
  </StrictMode>
);
