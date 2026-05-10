import { createKnowledgeGoldenEvalFixture, runKnowledgeGoldenEval } from '../src/index.js';

const fixture = createKnowledgeGoldenEvalFixture();
const result = runKnowledgeGoldenEval(fixture.dataset, fixture.observeCase);

console.log(
  JSON.stringify(
    {
      datasetId: result.datasetId,
      sampleCount: result.summary.sampleCount,
      topK: result.summary.topK,
      recallAtK: result.summary.recallAtK,
      mrr: result.summary.mrr,
      emptyRetrievalRate: result.summary.emptyRetrievalRate,
      groundedCitationRate: result.summary.groundedCitationRate,
      noAnswerAccuracy: result.summary.noAnswerAccuracy
    },
    null,
    2
  )
);
