import type { ToolExecutionRequest } from '@agent/core';
import {
  buildAgentScaffold,
  buildPackageScaffold,
  inspectScaffoldTarget,
  listScaffoldTemplates,
  writeScaffoldBundle
} from '../../scaffold/scaffold-core';

type ScaffoldHostKind = 'package' | 'agent';
type ScaffoldTemplateId = 'package-lib' | 'agent-basic';

export async function executeScaffoldTool(request: ToolExecutionRequest) {
  switch (request.toolName) {
    case 'list_scaffold_templates': {
      const hostKind = parseOptionalHostKind(request.input.hostKind);
      const templates = listScaffoldTemplates().filter(template => !hostKind || template.hostKind === hostKind);
      return {
        outputSummary: `Listed ${templates.length} scaffold template${templates.length === 1 ? '' : 's'}`,
        rawOutput: templates
      };
    }
    case 'preview_scaffold': {
      const bundle = await buildBundle(request);
      return {
        outputSummary: `Prepared ${bundle.hostKind} scaffold preview "${bundle.name}" with ${bundle.files.length} files`,
        rawOutput: bundle
      };
    }
    case 'write_scaffold': {
      const bundle = await buildBundle(request);
      const targetRoot = parseOptionalString(request.input.targetRoot);
      const inspection = await inspectScaffoldTarget({ bundle, targetRoot });

      if (request.input.force !== true && !inspection.canWriteSafely) {
        return {
          outputSummary: `Scaffold target is not empty: ${inspection.targetRoot}`,
          rawOutput: {
            blocked: true,
            inspection,
            bundle
          }
        };
      }

      const result = await writeScaffoldBundle({ bundle, targetRoot });
      return {
        outputSummary: `Wrote ${result.totalWritten} scaffold files into ${result.targetRoot}`,
        rawOutput: result
      };
    }
    default:
      return undefined;
  }
}

async function buildBundle(request: ToolExecutionRequest) {
  const hostKind = parseRequiredHostKind(request.input.hostKind);
  const input = {
    name: parseRequiredName(request.input.name),
    templateId: parseOptionalTemplateId(request.input.templateId),
    mode: request.toolName === 'write_scaffold' ? ('write' as const) : ('preview' as const),
    targetRoot: parseOptionalString(request.input.targetRoot)
  };

  return hostKind === 'package' ? buildPackageScaffold(input) : buildAgentScaffold(input);
}

function parseRequiredHostKind(value: unknown): ScaffoldHostKind {
  const parsed = parseOptionalHostKind(value);
  if (!parsed) {
    throw new Error('Scaffold tools require hostKind to be "package" or "agent".');
  }
  return parsed;
}

function parseOptionalHostKind(value: unknown): ScaffoldHostKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'package' || value === 'agent') {
    return value;
  }
  throw new Error(`Invalid scaffold hostKind: ${String(value)}`);
}

function parseRequiredName(value: unknown): string {
  const parsed = parseOptionalString(value);
  if (!parsed) {
    throw new Error('Scaffold tools require a non-empty name.');
  }
  return parsed;
}

function parseOptionalTemplateId(value: unknown): ScaffoldTemplateId | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'package-lib' || value === 'agent-basic') {
    return value;
  }
  throw new Error(`Invalid scaffold templateId: ${String(value)}`);
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
