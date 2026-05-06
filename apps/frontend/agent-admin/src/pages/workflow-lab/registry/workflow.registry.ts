export interface WorkflowFieldOption {
  value: string;
  label: string;
}

export interface WorkflowFieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  options?: WorkflowFieldOption[];
}

export interface WorkflowGraphNodeDef {
  id: string;
  label: string;
  ministry?: string;
}

export interface WorkflowGraphEdgeDef {
  from: string;
  to: string;
}

export interface WorkflowGraphDef {
  nodes: WorkflowGraphNodeDef[];
  edges: WorkflowGraphEdgeDef[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  fields: WorkflowFieldDef[];
  graph: WorkflowGraphDef;
  mapFormToPayload: (values: Record<string, string | number>) => Record<string, unknown>;
}

function textValue(values: Record<string, string | number>, key: string, fallback: string) {
  const value = values[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const workflowRegistry: WorkflowDefinition[] = [
  {
    id: 'company-live',
    name: '直播内容生成',
    description: '生成音频、图片、视频 bundle，适用于电商直播场景。',
    graph: {
      nodes: [
        { id: 'receive-brief', label: 'Receive Brief', ministry: 'hubu-research' },
        { id: 'generate-script', label: 'Generate Script', ministry: 'libu-protocol' },
        { id: 'create-assets', label: 'Create Assets', ministry: 'gongbu-code' },
        { id: 'assemble-bundle', label: 'Assemble Bundle', ministry: 'bingbu-runtime' }
      ],
      edges: [
        { from: 'receive-brief', to: 'generate-script' },
        { from: 'generate-script', to: 'create-assets' },
        { from: 'create-assets', to: 'assemble-bundle' }
      ]
    },
    fields: [
      {
        name: 'briefId',
        label: 'Brief ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. brief-2024-001',
        defaultValue: 'demo-brief-001'
      },
      {
        name: 'targetPlatform',
        label: '目标平台',
        type: 'select',
        required: true,
        defaultValue: 'douyin',
        options: [
          { value: 'douyin', label: '抖音' },
          { value: 'kuaishou', label: '快手' },
          { value: 'taobao', label: '淘宝直播' },
          { value: 'bilibili', label: 'B站' }
        ]
      },
      {
        name: 'script',
        label: '直播脚本',
        type: 'text',
        required: false,
        placeholder: '输入直播脚本（可选）',
        defaultValue: '欢迎来到我们的直播间，今天给大家带来超值好货！'
      },
      {
        name: 'requestedBy',
        label: '请求人',
        type: 'text',
        required: false,
        placeholder: 'e.g. user-001',
        defaultValue: 'admin'
      }
    ],
    mapFormToPayload: values => ({
      briefId: values.briefId,
      targetPlatform: values.targetPlatform,
      script: values.script ?? '',
      requestedBy: values.requestedBy ?? 'admin'
    })
  },
  {
    id: 'data-report-json',
    name: '报表 JSON 生成',
    description: '生成 report-bundle.v1 JSON，用于在管理台测试 data-report 报表链路。',
    graph: {
      nodes: [
        { id: 'receive-request', label: 'Receive Request', ministry: 'hubu-research' },
        { id: 'normalize-seed', label: 'Normalize Seed', ministry: 'libu-protocol' },
        { id: 'compile-report-bundle', label: 'Compile Report Bundle', ministry: 'gongbu-code' },
        { id: 'validate-contract', label: 'Validate Contract', ministry: 'xingbu-review' },
        { id: 'persist-run', label: 'Persist Run', ministry: 'bingbu-runtime' }
      ],
      edges: [
        { from: 'receive-request', to: 'normalize-seed' },
        { from: 'normalize-seed', to: 'compile-report-bundle' },
        { from: 'compile-report-bundle', to: 'validate-contract' },
        { from: 'validate-contract', to: 'persist-run' }
      ]
    },
    fields: [
      {
        name: 'message',
        label: '生成目标',
        type: 'text',
        required: true,
        placeholder: '输入报表生成需求',
        defaultValue: '生成奖金中心总览报表'
      },
      {
        name: 'reportId',
        label: 'Report ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. bonus-center-overview',
        defaultValue: 'bonus-center-overview'
      },
      {
        name: 'title',
        label: '报表标题',
        type: 'text',
        required: true,
        placeholder: 'e.g. 奖金中心总览',
        defaultValue: '奖金中心总览'
      },
      {
        name: 'serviceKey',
        label: '服务 Key',
        type: 'text',
        required: true,
        placeholder: 'e.g. bonusCenterService',
        defaultValue: 'bonusCenterService'
      },
      {
        name: 'route',
        label: '路由',
        type: 'text',
        required: true,
        placeholder: 'e.g. /bonus-center-overview',
        defaultValue: '/bonus-center-overview'
      }
    ],
    mapFormToPayload: values => {
      const title = textValue(values, 'title', '奖金中心总览');
      const serviceKey = textValue(values, 'serviceKey', 'bonusCenterService');

      return {
        message: textValue(values, 'message', '生成奖金中心总览报表'),
        projectId: 'agent-admin-workflow-lab',
        currentProjectPath: '/admin/workflow-lab',
        structuredSeed: {
          meta: {
            reportId: textValue(values, 'reportId', 'bonus-center-overview'),
            title,
            description: 'Workflow Lab generated report JSON test seed.',
            route: textValue(values, 'route', '/bonus-center-overview'),
            templateRef: 'workflow-lab',
            scope: 'single',
            layout: 'dashboard'
          },
          filters: [],
          dataSources: [
            {
              key: 'main',
              serviceKey,
              requestAdapter: {
                orgId: 'orgId'
              },
              responseAdapter: {
                listPath: 'data.list',
                totalPath: 'data.total'
              }
            }
          ],
          sections: [
            {
              id: 'overview',
              title,
              description: 'Workflow Lab report JSON smoke section.',
              dataSourceKey: 'main',
              metricsSpec: [
                {
                  key: 'amount',
                  label: '金额',
                  field: 'amount',
                  format: 'currency',
                  aggregate: 'sum'
                }
              ],
              chartSpec: {
                title: '趋势',
                chartType: 'line',
                xField: 'date',
                series: [
                  {
                    key: 'amount',
                    label: '金额',
                    field: 'amount',
                    seriesType: 'line'
                  }
                ]
              },
              tableSpec: {
                title: '明细',
                exportable: true,
                columns: [
                  {
                    title: '日期',
                    dataIndex: 'date',
                    width: 160
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    width: 140
                  }
                ]
              }
            }
          ]
        }
      };
    }
  }
];
