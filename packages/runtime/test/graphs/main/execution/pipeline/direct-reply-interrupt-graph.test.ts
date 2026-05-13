import { describe, expect, it, vi } from 'vitest';

const mockCompile = vi.fn(() => 'compiled-graph');
const mockAddConditionalEdges = vi.fn(function (this: any) {
  return this;
});
const mockAddEdge = vi.fn(function (this: any) {
  return this;
});
const mockAddNode = vi.fn(function (this: any) {
  return this;
});

const mockStateGraphInstance = {
  addNode: mockAddNode,
  addEdge: mockAddEdge,
  addConditionalEdges: mockAddConditionalEdges,
  compile: mockCompile
};

vi.mock('@langchain/langgraph', () => ({
  Annotation: Object.assign(vi.fn().mockReturnValue('annotated-type'), { Root: vi.fn().mockReturnValue({}) }),
  START: '__start__',
  END: '__end__',
  StateGraph: class MockStateGraph {
    addNode = mockAddNode;
    addEdge = mockAddEdge;
    addConditionalEdges = mockAddConditionalEdges;
    compile = mockCompile;
  }
}));

vi.mock('../../../../../src/flows/chat/direct-reply/direct-reply-interrupt-nodes', () => ({
  runDirectReplySkillGateNode: vi.fn(),
  runDirectReplyNode: vi.fn(),
  runDirectReplyInterruptFinishNode: vi.fn()
}));

import { buildDirectReplyInterruptGraph } from '../../../../../src/graphs/main/execution/pipeline/direct-reply-interrupt-graph';

describe('buildDirectReplyInterruptGraph', () => {
  it('creates and compiles a graph', () => {
    const result = buildDirectReplyInterruptGraph({
      task: { id: 'task-1' } as any,
      libu: {} as any,
      callbacks: {} as any,
      checkpointer: {} as any,
      store: {} as any
    });
    expect(result).toBe('compiled-graph');
  });

  it('registers skill_gate, direct_reply, and finish nodes', () => {
    buildDirectReplyInterruptGraph({
      task: { id: 'task-1' } as any,
      libu: {} as any,
      callbacks: {} as any,
      checkpointer: {} as any,
      store: {} as any
    });

    expect(mockAddNode).toHaveBeenCalledWith('skill_gate', expect.any(Function));
    expect(mockAddNode).toHaveBeenCalledWith('direct_reply', expect.any(Function));
    expect(mockAddNode).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('adds edges from START to skill_gate and direct_reply to finish to END', () => {
    buildDirectReplyInterruptGraph({
      task: { id: 'task-1' } as any,
      libu: {} as any,
      callbacks: {} as any,
      checkpointer: {} as any,
      store: {} as any
    });

    expect(mockAddEdge).toHaveBeenCalledWith('__start__', 'skill_gate');
    expect(mockAddEdge).toHaveBeenCalledWith('direct_reply', 'finish');
    expect(mockAddEdge).toHaveBeenCalledWith('finish', '__end__');
  });

  it('adds conditional edges from skill_gate', () => {
    buildDirectReplyInterruptGraph({
      task: { id: 'task-1' } as any,
      libu: {} as any,
      callbacks: {} as any,
      checkpointer: {} as any,
      store: {} as any
    });

    expect(mockAddConditionalEdges).toHaveBeenCalledWith('skill_gate', expect.any(Function));
  });

  it('compiles with checkpointer and store', () => {
    const checkpointer = { id: 'cp-1' };
    const store = { id: 'store-1' };
    buildDirectReplyInterruptGraph({
      task: { id: 'task-1' } as any,
      libu: {} as any,
      callbacks: {} as any,
      checkpointer: checkpointer as any,
      store: store as any
    });

    expect(mockCompile).toHaveBeenCalledWith({ checkpointer, store });
  });
});
