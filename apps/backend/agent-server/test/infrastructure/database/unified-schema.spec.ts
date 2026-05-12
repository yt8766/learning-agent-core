import { describe, expect, it } from 'vitest';

import { IDENTITY_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/identity-schema.sql';
import { KNOWLEDGE_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/knowledge-schema.sql';
import { RUNTIME_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/runtime-schema.sql';

describe('unified backend database schemas', () => {
  it('defines identity tables', () => {
    expect(IDENTITY_SCHEMA_SQL).toContain('identity_users');
    expect(IDENTITY_SCHEMA_SQL).toContain('global_roles');
    expect(IDENTITY_SCHEMA_SQL).toContain('identity_refresh_sessions');
    expect(IDENTITY_SCHEMA_SQL).toContain('identity_refresh_tokens');
  });

  it('defines knowledge tables', () => {
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_bases');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_uploads');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_documents');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_document_chunks');
    expect(KNOWLEDGE_SCHEMA_SQL).toContain('knowledge_eval_runs');
  });

  it('defines runtime workflow tables', () => {
    expect(RUNTIME_SCHEMA_SQL).toContain('workflow_runs');
    expect(RUNTIME_SCHEMA_SQL).toContain('"workflowId"');
    expect(RUNTIME_SCHEMA_SQL).toContain('"inputData"');
    expect(RUNTIME_SCHEMA_SQL).toContain('"traceData"');
  });
});
