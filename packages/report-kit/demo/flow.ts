import { assembleDataReportBundle, buildDataReportBlueprint, buildDataReportModuleScaffold } from '../src/index.js';

const blueprint = buildDataReportBlueprint({
  goal: '生成一个通用数据报表页面，包含趋势图和指标卡',
  templateId: 'react-ts'
});
const moduleResult = buildDataReportModuleScaffold({
  goal: '生成一个通用数据报表页面，包含趋势图和指标卡',
  templateId: 'react-ts',
  moduleId: blueprint.modules[0]!.id
});
const assembly = assembleDataReportBundle({
  blueprint,
  moduleResults: [moduleResult],
  sharedFiles: [],
  routeFiles: []
});

console.log(
  JSON.stringify(
    {
      templateId: blueprint.templateId,
      moduleCount: blueprint.modules.length,
      assembledFiles: Object.keys(assembly.sandpackFiles).length,
      firstModule: moduleResult.module.id
    },
    null,
    2
  )
);
