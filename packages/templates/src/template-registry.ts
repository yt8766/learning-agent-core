import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { FrontendTemplateDefinition } from './types';

function resolveFrontendTemplatesRootDir(): string {
  const candidates = [
    join(resolve(process.cwd()), 'packages', 'templates', 'src'),
    resolve(__dirname),
    resolve(__dirname, '..', 'src'),
    resolve(__dirname, '..', '..', 'src')
  ];

  const resolved = candidates.find(candidate => existsSync(join(candidate, 'react-ts')));
  return resolved ?? candidates[0] ?? join(resolve(process.cwd()), 'packages', 'templates', 'src');
}

const FRONTEND_TEMPLATES: FrontendTemplateDefinition[] = [
  {
    id: 'react-ts',
    displayName: 'React TypeScript',
    description: '基础 React + TypeScript 前端模板目录，结构参考 duyi-figma-make 的 server/templates/react-ts。',
    directoryName: 'react-ts',
    entryFiles: ['App.tsx', 'index.tsx', 'package.json', 'styles.css'],
    outputRoot: 'template',
    defaultBaseDir: 'data/generated/data-report'
  },
  {
    id: 'bonus-center-data',
    displayName: 'Bonus Center Data Report',
    description: '参考 gosh_admin_fe 的 bonusCenterData 页面结构，包含 pages、services、types 以及 routes 模板。',
    directoryName: 'bonus-center-data',
    entryFiles: [
      'pages/dataDashboard/bonusCenterData/index.tsx',
      'pages/dataDashboard/bonusCenterData/config.tsx',
      'pages/dataDashboard/bonusCenterData/components/Search/index.tsx',
      'services/data/bonusCenter.ts',
      'types/data/bonusCenter.ts',
      'routes.ts'
    ],
    sharedEntryFiles: [
      'pages/dataDashboard/bonusCenterData/index.tsx',
      'pages/dataDashboard/bonusCenterData/config.tsx',
      'pages/dataDashboard/bonusCenterData/components/Search/index.tsx',
      'services/data/bonusCenter.ts',
      'types/data/bonusCenter.ts',
      'routes.ts'
    ],
    moduleDirectories: ['pages/dataDashboard/bonusCenterData/components'],
    includeAllFiles: true,
    outputRoot: '',
    defaultBaseDir: 'src'
  },
  {
    id: 'single-report-table',
    displayName: 'Single Report Table Page',
    description: '单报表 table-first 页面模板，适用于只有查询和表格、不需要图表与指标卡的场景。',
    directoryName: 'single-report-table',
    entryFiles: ['pages/dataDashboard/generatedReport/index.tsx'],
    outputRoot: '',
    defaultBaseDir: 'src'
  }
];

export function listFrontendTemplates(): FrontendTemplateDefinition[] {
  return FRONTEND_TEMPLATES;
}

export function getFrontendTemplate(templateId: string): FrontendTemplateDefinition | undefined {
  return FRONTEND_TEMPLATES.find(template => template.id === templateId);
}

export function resolveFrontendTemplateDir(templateId: string) {
  const template = getFrontendTemplate(templateId);
  if (!template) {
    return undefined;
  }
  return join(resolveFrontendTemplatesRootDir(), template.directoryName);
}
