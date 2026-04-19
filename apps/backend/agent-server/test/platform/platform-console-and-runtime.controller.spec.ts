import { describe, expect, it } from 'vitest';

import { PlatformConsoleController } from '../../src/platform/platform-console.controller';
import { PlatformBriefingsController } from '../../src/platform/platform-briefings.controller';
import { RuntimeCenterController } from '../../src/platform/runtime-center.controller';
import { createPlatformControllerDeps } from './platform-controller.test-helpers';

describe('platform console and runtime controllers', () => {
  it('delegates console, observability and briefing routes', async () => {
    const { runtimeCentersService } = createPlatformControllerDeps();
    const consoleController = new PlatformConsoleController(runtimeCentersService as never);
    const runtimeController = new RuntimeCenterController(runtimeCentersService as never);
    const briefingController = new PlatformBriefingsController(runtimeCentersService as never);

    await expect(
      consoleController.getConsole(
        {
          view: 'shell',
          status: 'running',
          model: 'gpt-5.4',
          pricingSource: 'provider-billing',
          runtimeExecutionMode: 'plan',
          runtimeInteractionKind: 'plan-question',
          approvalsExecutionMode: 'execute',
          approvalsInteractionKind: 'approval'
        },
        7
      )
    ).resolves.toEqual(expect.objectContaining({ scope: 'console-shell' }));
    expect(runtimeCentersService.getPlatformConsoleShell).toHaveBeenCalledWith(7, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider-billing',
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'plan-question',
      approvalsExecutionMode: 'execute',
      approvalsInteractionKind: 'approval'
    });

    await expect(consoleController.getConsole({ view: 'full', model: 'gpt-5.4' }, 21)).resolves.toEqual(
      expect.objectContaining({ scope: 'console' })
    );
    expect(runtimeCentersService.getPlatformConsole).toHaveBeenCalledWith(21, {
      status: undefined,
      model: 'gpt-5.4',
      pricingSource: undefined,
      runtimeExecutionMode: undefined,
      runtimeInteractionKind: undefined,
      approvalsExecutionMode: undefined,
      approvalsInteractionKind: undefined
    });

    await expect(consoleController.getConsoleShell({ model: 'gpt-5.4' }, 14)).resolves.toEqual(
      expect.objectContaining({ scope: 'console-shell' })
    );
    expect(runtimeCentersService.getPlatformConsoleShell).toHaveBeenCalledWith(14, {
      status: undefined,
      model: 'gpt-5.4',
      pricingSource: undefined,
      runtimeExecutionMode: undefined,
      runtimeInteractionKind: undefined,
      approvalsExecutionMode: undefined,
      approvalsInteractionKind: undefined
    });

    expect(runtimeController.getRuntimeCenter({ status: 'failed', executionMode: 'execute' }, 30)).toEqual(
      expect.objectContaining({ scope: 'runtime' })
    );
    expect(runtimeController.getRunObservatory({ q: 'fix', hasInterrupt: 'true', limit: '25' })).toEqual({
      scope: 'run-observatory',
      args: {
        status: undefined,
        model: undefined,
        pricingSource: undefined,
        executionMode: undefined,
        interactionKind: undefined,
        q: 'fix',
        hasInterrupt: 'true',
        hasFallback: undefined,
        hasRecoverableCheckpoint: undefined,
        limit: '25'
      }
    });
    expect(runtimeController.getRunObservatoryDetail('task-1')).toEqual({
      scope: 'run-observatory-detail',
      taskId: 'task-1'
    });

    expect(runtimeController.exportRuntimeCenter({ format: 'json', interactionKind: 'approval' }, undefined)).toEqual(
      expect.objectContaining({ scope: 'runtimeExport' })
    );
    expect(runtimeCentersService.exportRuntimeCenter).toHaveBeenCalledWith({
      days: undefined,
      status: undefined,
      model: undefined,
      pricingSource: undefined,
      executionMode: undefined,
      interactionKind: 'approval',
      format: 'json'
    });

    expect(briefingController.getWorkflowPresets()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'general' })])
    );
    expect(briefingController.getBriefingRuns(7, 'general-security')).toEqual(
      expect.objectContaining({ scope: 'briefings' })
    );
    expect(briefingController.forceBriefingRun('backend-tech')).toEqual({ category: 'backend-tech', forced: true });
    expect(
      briefingController.recordBriefingFeedback({
        messageKey: 'general-security:postgres',
        category: 'general-security',
        feedbackType: 'helpful',
        reasonTag: 'useful-actionable'
      })
    ).toEqual({
      saved: true,
      body: {
        messageKey: 'general-security:postgres',
        category: 'general-security',
        feedbackType: 'helpful',
        reasonTag: 'useful-actionable'
      }
    });
  });
});
