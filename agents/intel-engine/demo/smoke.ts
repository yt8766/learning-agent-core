import { createIntelGraph } from '../src';

const graph = createIntelGraph();

if (typeof graph.compile !== 'function') {
  throw new Error('Expected createIntelGraph() to return a LangGraph StateGraph instance.');
}

console.log('[intel-engine demo] graph ready');
