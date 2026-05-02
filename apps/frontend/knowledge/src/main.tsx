import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'antd/dist/reset.css';
import './styles/knowledge-pro.css';

import { AuthClient } from './api/auth-client';
import { KnowledgeApiClient } from './api/knowledge-api-client';
import { KnowledgeApiProvider, type KnowledgeFrontendApi } from './api/knowledge-api-provider';
import { MockKnowledgeApiClient } from './api/mock-knowledge-api-client';
import { App } from './app/App';

const authServiceBaseUrl = import.meta.env.VITE_AUTH_SERVICE_BASE_URL ?? 'http://127.0.0.1:3010/api';
const knowledgeServiceBaseUrl = import.meta.env.VITE_KNOWLEDGE_SERVICE_BASE_URL ?? 'http://127.0.0.1:3020/api';
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
