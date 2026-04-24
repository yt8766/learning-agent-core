import { describe, expect, it } from 'vitest';

import {
  assembleDataReportBundle,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportRoutes,
  buildDataReportScaffold,
  postProcessDataReportSandpackFiles,
  renderDataReportJsonBundleFiles,
  writeDataReportBundle
} from '../src';
import * as dataReportFacade from '../src/contracts/data-report-facade';
import { assembleDataReportBundle as canonicalAssembleDataReportBundle } from '../src/assembly/data-report-assembly';
import { postProcessDataReportSandpackFiles as canonicalPostProcessDataReportSandpackFiles } from '../src/assembly/data-report-ast-postprocess';
import { buildDataReportRoutes as canonicalBuildDataReportRoutes } from '../src/assembly/data-report-routes';
import { buildDataReportBlueprint as canonicalBuildDataReportBlueprint } from '../src/blueprints/data-report-blueprint';
import { buildDataReportModuleScaffold as canonicalBuildDataReportModuleScaffold } from '../src/scaffold/data-report-module-scaffold';
import { buildDataReportScaffold as canonicalBuildDataReportScaffold } from '../src/scaffold/data-report-scaffold';
import { renderDataReportJsonBundleFiles as canonicalRenderDataReportJsonBundleFiles } from '../src/json-renderer/data-report-json-renderer';
import { writeDataReportBundle as canonicalWriteDataReportBundle } from '../src/writers/data-report-write';

describe('@agent/report-kit root exports', () => {
  it('keeps root report-kit exports wired to canonical hosts', () => {
    expect(buildDataReportBlueprint).toBe(canonicalBuildDataReportBlueprint);
    expect(buildDataReportScaffold).toBe(canonicalBuildDataReportScaffold);
    expect(buildDataReportModuleScaffold).toBe(canonicalBuildDataReportModuleScaffold);
    expect(buildDataReportRoutes).toBe(canonicalBuildDataReportRoutes);
    expect(postProcessDataReportSandpackFiles).toBe(canonicalPostProcessDataReportSandpackFiles);
    expect(assembleDataReportBundle).toBe(canonicalAssembleDataReportBundle);
    expect(renderDataReportJsonBundleFiles).toBe(canonicalRenderDataReportJsonBundleFiles);
    expect(writeDataReportBundle).toBe(canonicalWriteDataReportBundle);
  });

  it('keeps the package root aligned with the stable data report facade contract', () => {
    expect(buildDataReportBlueprint).toBe(dataReportFacade.buildDataReportBlueprint);
    expect(buildDataReportScaffold).toBe(dataReportFacade.buildDataReportScaffold);
    expect(buildDataReportModuleScaffold).toBe(dataReportFacade.buildDataReportModuleScaffold);
    expect(buildDataReportRoutes).toBe(dataReportFacade.buildDataReportRoutes);
    expect(postProcessDataReportSandpackFiles).toBe(dataReportFacade.postProcessDataReportSandpackFiles);
    expect(assembleDataReportBundle).toBe(dataReportFacade.assembleDataReportBundle);
    expect(renderDataReportJsonBundleFiles).toBe(dataReportFacade.renderDataReportJsonBundleFiles);
    expect(writeDataReportBundle).toBe(dataReportFacade.writeDataReportBundle);
  });
});
