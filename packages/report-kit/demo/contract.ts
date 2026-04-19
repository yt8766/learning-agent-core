import {
  assembleDataReportBundle,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportRoutes,
  buildDataReportScaffold,
  postProcessDataReportSandpackFiles,
  writeDataReportBundle
} from '../src/index.js';
import * as dataReportFacade from '../src/contracts/data-report-facade.js';
import { assembleDataReportBundle as canonicalAssembleDataReportBundle } from '../src/assembly/data-report-assembly.js';
import { postProcessDataReportSandpackFiles as canonicalPostProcessDataReportSandpackFiles } from '../src/assembly/data-report-ast-postprocess.js';
import { buildDataReportRoutes as canonicalBuildDataReportRoutes } from '../src/assembly/data-report-routes.js';
import { buildDataReportBlueprint as canonicalBuildDataReportBlueprint } from '../src/blueprints/data-report-blueprint.js';
import { buildDataReportModuleScaffold as canonicalBuildDataReportModuleScaffold } from '../src/scaffold/data-report-module-scaffold.js';
import { buildDataReportScaffold as canonicalBuildDataReportScaffold } from '../src/scaffold/data-report-scaffold.js';
import { writeDataReportBundle as canonicalWriteDataReportBundle } from '../src/writers/data-report-write.js';

console.log(
  JSON.stringify(
    {
      rootAligned:
        buildDataReportBlueprint === canonicalBuildDataReportBlueprint &&
        buildDataReportScaffold === canonicalBuildDataReportScaffold &&
        buildDataReportModuleScaffold === canonicalBuildDataReportModuleScaffold &&
        buildDataReportRoutes === canonicalBuildDataReportRoutes &&
        postProcessDataReportSandpackFiles === canonicalPostProcessDataReportSandpackFiles &&
        assembleDataReportBundle === canonicalAssembleDataReportBundle &&
        writeDataReportBundle === canonicalWriteDataReportBundle,
      contractAligned:
        buildDataReportBlueprint === dataReportFacade.buildDataReportBlueprint &&
        buildDataReportScaffold === dataReportFacade.buildDataReportScaffold &&
        buildDataReportModuleScaffold === dataReportFacade.buildDataReportModuleScaffold &&
        buildDataReportRoutes === dataReportFacade.buildDataReportRoutes &&
        postProcessDataReportSandpackFiles === dataReportFacade.postProcessDataReportSandpackFiles &&
        assembleDataReportBundle === dataReportFacade.assembleDataReportBundle &&
        writeDataReportBundle === dataReportFacade.writeDataReportBundle
    },
    null,
    2
  )
);
