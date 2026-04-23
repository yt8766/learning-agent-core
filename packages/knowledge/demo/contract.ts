import { existsSync } from 'node:fs';

import { DefaultKnowledgeSearchService, RetrievalRequestSchema, runKnowledgeIndexing } from '../src/index.js';
import * as indexingExports from '../src/indexing/index.js';
import * as retrievalExports from '../src/retrieval/knowledge-search-service.js';

const schemaProbe = RetrievalRequestSchema.safeParse({
  query: 'runtime approvals observability'
});

console.log(
  JSON.stringify(
    {
      retrievalHostAligned: DefaultKnowledgeSearchService === retrievalExports.DefaultKnowledgeSearchService,
      indexingHostAligned: runKnowledgeIndexing === indexingExports.runKnowledgeIndexing,
      contractFacadePresent: existsSync(new URL('../src/contracts/knowledge-facade.ts', import.meta.url)),
      schemaAccepted: schemaProbe.success
    },
    null,
    2
  )
);
