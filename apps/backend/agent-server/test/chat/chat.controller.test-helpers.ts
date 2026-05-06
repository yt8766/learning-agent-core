import { vi } from 'vitest';

export function createSseResponse() {
  return {
    cookie: vi.fn(),
    status: vi.fn(function status() {
      return this;
    }),
    json: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    flush: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  };
}

export function createRequest() {
  return { headers: {} };
}

export function createResponse() {
  return { cookie: vi.fn() };
}

export function createChatService() {
  return {
    resolveDirectResponseMode: vi.fn(() => 'stream'),
    generateSandpackPreview: vi.fn(async () => ({
      '/App.tsx': { code: 'export default function App() { return null; }' }
    })),
    streamSandpackPreview: vi.fn(async (_dto, push) => {
      push({ type: 'stage', data: { stage: 'analysis', progressPercent: 5, status: 'pending' } });
      push({
        type: 'files',
        data: {
          files: {
            '/App.tsx': 'export default function App() { return null; }',
            '/routes.ts': 'export const reportRoutes = [];',
            '/index.tsx': 'export default function Preview() { return null; }'
          }
        }
      });
      return {
        '/App.tsx': { code: 'export default function App() { return null; }' },
        '/routes.ts': { code: 'export const reportRoutes = [];' },
        '/index.tsx': { code: 'export default function Preview() { return null; }' }
      };
    }),
    streamChat: vi.fn(async (_dto, push) => {
      push({ type: 'token', data: { content: '你' } });
      push({ type: 'token', data: { content: '好' } });
      return { content: '你好' };
    }),
    streamReportSchema: vi.fn(async (_dto, push) => {
      push({
        type: 'schema_failed',
        data: {
          error: {
            errorCode: 'report_schema_generation_failed',
            errorMessage: 'provider exploded',
            retryable: true
          },
          runtime: {
            executionPath: 'partial-llm',
            cacheHit: false,
            nodeDurations: {
              sectionSchemaNode: 12
            }
          }
        }
      });
      return {
        status: 'failed',
        content: '{"status":"failed"}',
        bundle: {
          version: 'report-bundle.v1',
          kind: 'report-bundle',
          meta: {
            bundleId: 'bundle-1',
            title: 'Bonus Center',
            mode: 'single-document'
          },
          documents: []
        },
        error: {
          errorCode: 'report_schema_generation_failed',
          errorMessage: 'provider exploded',
          retryable: true
        },
        runtime: {
          executionPath: 'partial-llm',
          cacheHit: false,
          nodeDurations: {
            sectionSchemaNode: 12
          }
        }
      };
    }),
    listSessions: vi.fn(() => ['session-1']),
    listAvailableModels: vi.fn(() => [
      { id: 'minimax/MiniMax-M2.7', displayName: 'MiniMax-M2.7', providerId: 'minimax' }
    ]),
    createSession: vi.fn(dto => ({ id: 'session-1', ...dto })),
    getSession: vi.fn(id => ({ id })),
    listMessages: vi.fn(id => [{ sessionId: id, role: 'user', content: 'hello' }]),
    listEvents: vi.fn(id => [{ sessionId: id, type: 'session_started' }]),
    getCheckpoint: vi.fn(id => ({ sessionId: id, taskId: 'task-1' })),
    listRuns: vi.fn(id => [{ id: 'run-1', sessionId: id, status: 'running' }]),
    getRun: vi.fn(id => ({ id, sessionId: 'session-1', status: 'running' })),
    cancelRun: vi.fn(id => ({ id, sessionId: 'session-1', status: 'cancelled' })),
    appendMessage: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    approve: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    reject: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    confirmLearning: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    recover: vi.fn(id => ({ sessionId: id, recovered: true })),
    cancel: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    subscribe: vi.fn(() => vi.fn())
  };
}
