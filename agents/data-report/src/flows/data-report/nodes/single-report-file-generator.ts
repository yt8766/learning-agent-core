import {
  MODEL_CAPABILITIES,
  createModelCapabilities,
  withLlmRetry,
  type ChatMessage,
  type GenerateTextOptions
} from '@agent/adapters';
import type { DataReportSandpackFiles, DataReportSandpackGraphState } from '../../../types/data-report';
import {
  buildChartComponentCode,
  buildComponentPageCode,
  buildMetricsComponentCode,
  buildPageOnlyMockPageCode,
  buildTableComponentCode
} from './single-report-component-builders';
import { buildMockServiceCode, buildTypesFromMock } from './single-report-type-helpers';

export interface SingleReportFilePlan {
  path: string;
  instruction: string;
  phase: 'leaf' | 'aggregate';
  generator?: 'llm' | 'mock';
}

export interface SingleReportFilePlanGroups {
  leafPlans: SingleReportFilePlan[];
  aggregatePlans: SingleReportFilePlan[];
}

function buildMockSampleBlock(state: DataReportSandpackGraphState) {
  if (state.mockData?.mode !== 'file' || typeof state.mockData.payload === 'undefined') {
    return null;
  }

  return [
    `Mock file: ${state.mockData.mockFile ?? 'data-report/mock.json'}`,
    'Use this mock payload shape as the primary contract for the generated code:',
    JSON.stringify(state.mockData.payload, null, 2)
  ].join('\n');
}

export function isSingleReport(state: DataReportSandpackGraphState) {
  const referenceMode = state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope;
  const templateId = state.blueprint?.templateId ?? state.analysis?.templateId;
  return referenceMode === 'single' && templateId === 'bonus-center-data';
}

export function buildRootFiles(state: DataReportSandpackGraphState): DataReportSandpackFiles {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';

  return {
    '/App.tsx': `import ReportPage from './src/pages/dataDashboard/${routeName}';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportPage />
    </main>
  );
}
`
  };
}

export function buildFilePlans(state: DataReportSandpackGraphState): SingleReportFilePlanGroups {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';
  const routeTitle = state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview';
  const servicePath = state.structure?.serviceFile ?? `/src/services/data/${routeName}.ts`;
  const typesPath = state.structure?.typesFile ?? `/src/types/data/${routeName}.ts`;
  const pagePath = state.structure?.pageFile ?? `/src/pages/dataDashboard/${routeName}/index.tsx`;
  const analysis = JSON.stringify(state.analysis ?? {}, null, 2);
  const singleReportMode = state.components?.singleReportMode ?? 'page-only';
  const componentPlans = state.components?.planned ?? [];
  const mockSampleBlock = buildMockSampleBlock(state);
  const hasMockPayload = state.mockData?.mode === 'file' && typeof state.mockData.payload !== 'undefined';

  if (singleReportMode === 'page-only') {
    return {
      leafPlans: [
        {
          path: servicePath,
          phase: 'leaf',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${servicePath}`,
            `Build the real service file for "${routeTitle}".`,
            `Prefer using the data source hint "${state.analysis?.dataSourceHint ?? ''}" when naming the request.`,
            hasMockPayload
              ? 'A mock payload has already been prepared, so the service file can use the known mock response shape.'
              : `Do not return mock data; keep the code ready for real interaction.`,
            `Export the function name ${state.service?.exportName ?? `fetch${routeName}Report`}.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        },
        {
          path: typesPath,
          phase: 'leaf',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${typesPath}`,
            `Build the shared type definitions for "${routeTitle}".`,
            `The report is table-first, so prioritize table row, search params, and response payload types.`,
            `Use export interface declarations.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        }
      ],
      aggregatePlans: [
        {
          path: pagePath,
          phase: 'aggregate',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${pagePath}`,
            `Build a single-page big-data report for "${routeTitle}".`,
            'Follow a table-first structure similar to a real gosh_admin_fe data report page.',
            'Use PageContainer + ProTable + real request loading + GoshExportButton.',
            'Search items should live in ProTable search, and export should be rendered with the existing GoshExportButton pattern.',
            'Use the current template component import for GoshExportButton and do not invent other component locations.',
            `Import the real service from '${servicePath}'.`,
            `Use relative imports for '${typesPath}' when types are needed.`,
            "Do not import PaginationResult from '@/utils/request' and do not depend on any '@/utils/request' file.",
            `Do not create Chart or Metrics components for this page.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        }
      ]
    };
  }

  const componentFilePlans = componentPlans.map(plan => {
    const lowerPath = plan.path.toLowerCase();
    const fileKind = lowerPath.includes('chart')
      ? 'chart'
      : lowerPath.includes('metrics')
        ? 'metrics'
        : lowerPath.includes('table')
          ? 'table'
          : 'component';
    const extraInstructions =
      fileKind === 'table'
        ? [
            'Every table must include export support.',
            'If you use ProTable, render GoshExportButton in toolBarRender and pass columns, data, title, intl, enableAudit, menuName, and getQueryParams exactly in that format.'
          ]
        : [];

    return {
      path: plan.path,
      phase: 'leaf' as const,
      generator: hasMockPayload ? ('mock' as const) : ('llm' as const),
      instruction: [
        `Target file: ${plan.path}`,
        `Build the ${fileKind} component for "${routeTitle}".`,
        `Purpose: ${plan.purpose}`,
        `Use relative imports for '${typesPath}' when types are needed.`,
        'Use the current template component import for GoshExportButton and do not invent other component locations.',
        "Do not import PaginationResult from '@/utils/request' and do not depend on any '@/utils/request' file.",
        ...extraInstructions,
        mockSampleBlock ?? '',
        `Context: ${analysis}`
      ].join('\n')
    };
  });

  return {
    leafPlans: [
      ...componentFilePlans,
      {
        path: servicePath,
        phase: 'leaf',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${servicePath}`,
          `Build the real service file for "${routeTitle}".`,
          `Prefer using the data source hint "${state.analysis?.dataSourceHint ?? ''}" when naming the request.`,
          hasMockPayload
            ? 'A mock payload has already been prepared, so the service file can use the known mock response shape.'
            : `Do not return mock data; keep the code ready for real interaction.`,
          `Export the function name ${state.service?.exportName ?? `fetch${routeName}Report`}.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      },
      {
        path: typesPath,
        phase: 'leaf',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${typesPath}`,
          `Build the shared type definitions for "${routeTitle}".`,
          `Include metric, chart, and table row types that the page and widgets can reuse.`,
          `Use export interface declarations.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      }
    ],
    aggregatePlans: [
      {
        path: pagePath,
        phase: 'aggregate',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${pagePath}`,
          `Build the single report page for "${routeTitle}".`,
          `It must import any planned chart/metrics/table components from './components/*'.`,
          `Use @ant-design/pro-components PageContainer as the page shell.`,
          `Do not use mock data inside the page.`,
          `Assume the planned leaf components already exist.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      }
    ]
  };
}

async function generateSingleFile(state: DataReportSandpackGraphState, plan: SingleReportFilePlan) {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';
  if (plan.generator === 'mock' && state.mockData?.mode === 'file' && typeof state.mockData.payload !== 'undefined') {
    const code =
      plan.path === (state.structure?.serviceFile ?? `/src/services/data/${routeName}.ts`)
        ? buildMockServiceCode(state, routeName, state.mockData.payload)
        : plan.path === (state.structure?.pageFile ?? `/src/pages/dataDashboard/${routeName}/index.tsx`)
          ? state.components?.singleReportMode === 'page-only'
            ? buildPageOnlyMockPageCode(
                state,
                routeName,
                state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview'
              )
            : buildComponentPageCode(
                state,
                routeName,
                state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview'
              )
          : plan.path === (state.structure?.typesFile ?? `/src/types/data/${routeName}.ts`)
            ? buildTypesFromMock(routeName, state.mockData.payload)
            : plan.path.toLowerCase().includes('table')
              ? buildTableComponentCode(
                  plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportTable',
                  routeName,
                  state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview',
                  state.mockData.payload
                )
              : plan.path.toLowerCase().includes('metrics')
                ? buildMetricsComponentCode(
                    plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportMetrics',
                    routeName,
                    state.mockData.payload
                  )
                : buildChartComponentCode(
                    plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportChart',
                    routeName,
                    state.mockData.payload
                  );
    state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'success' });
    return [plan.path, code.trim()] as const;
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a frontend code generator. Return only the file source code for the requested target file. Do not wrap in markdown fences.'
    },
    {
      role: 'user',
      content: plan.instruction
    }
  ];
  const options: GenerateTextOptions = {
    role: 'manager',
    modelId: state.modelId,
    temperature: typeof state.temperature === 'number' ? state.temperature : 0.1,
    maxTokens: state.maxTokens,
    requiredCapabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT)
  };
  const llm = state.llm;

  if (!llm) {
    throw new Error('Configured LLM provider does not support text generation.');
  }

  const code: string = await withLlmRetry(
    async currentMessages => {
      if (typeof llm.generateText === 'function') {
        return llm.generateText(currentMessages, options);
      }

      if (typeof llm.streamText === 'function') {
        let content = '';
        const streamed = await llm.streamText(currentMessages, options, (token: string) => {
          content += token;
        });
        return streamed || content;
      }

      throw new Error('Configured LLM provider does not support text generation.');
    },
    messages,
    {
      onRetry: state.onRetry
    }
  );

  state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'success' });
  return [plan.path, code.trim()] as const;
}

function emitPendingEvents(state: DataReportSandpackGraphState, plans: SingleReportFilePlan[]) {
  for (const plan of plans) {
    state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'pending' });
  }
}

export async function generateSingleReportPlannedFiles(
  state: DataReportSandpackGraphState,
  plans: SingleReportFilePlan[]
) {
  if (!state.llm || !isSingleReport(state) || plans.length === 0) {
    return null;
  }

  emitPendingEvents(state, plans);
  const entries = await Promise.all(plans.map(plan => generateSingleFile(state, plan)));
  return Object.fromEntries(entries) as DataReportSandpackFiles;
}

export async function generateSingleReportFiles(state: DataReportSandpackGraphState) {
  if (!state.llm || !isSingleReport(state)) {
    return null;
  }

  const { leafPlans, aggregatePlans } = buildFilePlans(state);
  const leafFiles = (await generateSingleReportPlannedFiles(state, leafPlans)) ?? {};
  const aggregateFiles = (await generateSingleReportPlannedFiles(state, aggregatePlans)) ?? {};
  const files: DataReportSandpackFiles = {
    ...buildRootFiles(state),
    ...leafFiles,
    ...aggregateFiles
  };

  return {
    content: JSON.stringify({ status: 'success', files }),
    payload: {
      status: 'success' as const,
      files
    }
  };
}
