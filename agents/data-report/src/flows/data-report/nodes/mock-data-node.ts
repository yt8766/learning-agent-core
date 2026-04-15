import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { traceNode, type NodePatch } from './shared';

export async function runMockDataNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.mockDataNode) {
    return traceNode(state, 'mockDataNode', await handlers.mockDataNode(state));
  }

  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';
  const mocked = await tryExecuteMock(state, 'mockDataNode', `data-report/${routeName}.json`, data => ({
    mockData: {
      mode: 'file' as const,
      mockFile: `data-report/${routeName}.json`,
      note: '通过 utils/mock 加载数据报表 mock 文件。',
      payload: data
    }
  }));

  if (mocked) {
    return traceNode(state, 'mockDataNode', mocked);
  }

  return traceNode(state, 'mockDataNode', {
    mockData: {
      mode: 'disabled',
      note: '未启用数据报表 mock，默认继续走真实生成链路。'
    }
  });
}
