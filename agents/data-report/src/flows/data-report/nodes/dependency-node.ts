import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { traceNode, type NodePatch } from './shared';

export async function runDependencyNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.dependencyNode) {
    return traceNode(state, 'dependencyNode', await handlers.dependencyNode(state));
  }

  return traceNode(state, 'dependencyNode', {
    dependency: {
      runtime: 'react-ts',
      packages: [
        'react',
        'react-dom',
        'typescript',
        'antd',
        '@ant-design/pro-components',
        '@ant-design/plots',
        'dayjs'
      ],
      importStrategy: 'static-imports-only'
    }
  });
}
