import { ActionIntent } from '@agent/core';
import {
  buildAgentScaffold,
  buildPackageScaffold,
  inspectScaffoldTarget,
  type ScaffoldBundle,
  type ScaffoldTargetInspection
} from '@agent/tools';

type ScaffoldHostKind = 'package' | 'agent';
type ScaffoldTemplateId = 'package-lib' | 'agent-basic';
type ScaffoldAction = 'list-templates' | 'preview' | 'write';
type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface ParsedScaffoldWorkflowCommand {
  action: ScaffoldAction;
  hostKind?: ScaffoldHostKind;
  name?: string;
  templateId?: ScaffoldTemplateId;
  targetRoot?: string;
  force?: boolean;
}

export function parseScaffoldWorkflowCommand(goal: string): ParsedScaffoldWorkflowCommand {
  const tokens = tokenizeScaffoldGoal(goal.trim());
  const action = tokens[0];

  if (action !== 'list-templates' && action !== 'preview' && action !== 'write') {
    throw new Error(`Unsupported /scaffold action: ${action ?? '(missing)'}`);
  }

  const command: ParsedScaffoldWorkflowCommand = {
    action
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    switch (token) {
      case '--host-kind':
        command.hostKind = parseHostKind(nextToken(tokens, ++index, token));
        break;
      case '--name':
        command.name = nextToken(tokens, ++index, token);
        break;
      case '--template-id':
        command.templateId = parseTemplateId(nextToken(tokens, ++index, token));
        break;
      case '--target-root':
        command.targetRoot = nextToken(tokens, ++index, token);
        break;
      case '--force':
        command.force = true;
        break;
      case '--format':
        nextToken(tokens, ++index, token);
        break;
      default:
        throw new Error(`Unknown /scaffold option: ${token}`);
    }
  }

  return command;
}

export function resolveScaffoldToolName(
  goal: string
): 'list_scaffold_templates' | 'preview_scaffold' | 'write_scaffold' {
  const command = parseScaffoldWorkflowCommand(goal);
  switch (command.action) {
    case 'list-templates':
      return 'list_scaffold_templates';
    case 'preview':
      return 'preview_scaffold';
    case 'write':
      return 'write_scaffold';
  }
}

export function resolveScaffoldIntent(goal: string): ActionIntentValue {
  return parseScaffoldWorkflowCommand(goal).action === 'write' ? ActionIntent.WRITE_FILE : ActionIntent.READ_FILE;
}

export function buildScaffoldWorkflowToolInput(goal: string): Record<string, unknown> {
  const command = parseScaffoldWorkflowCommand(goal);

  if (command.action === 'list-templates') {
    return command.hostKind ? { hostKind: command.hostKind } : {};
  }

  return {
    hostKind: requireField(command.hostKind, 'host-kind'),
    name: requireField(command.name, 'name'),
    templateId: command.templateId,
    targetRoot: command.targetRoot,
    force: command.force === true
  };
}

export async function inspectScaffoldWriteCommand(goal: string): Promise<{
  toolInput: Record<string, unknown>;
  bundle: ScaffoldBundle;
  inspection: ScaffoldTargetInspection;
}> {
  const command = parseScaffoldWorkflowCommand(goal);
  if (command.action !== 'write') {
    throw new Error(`Scaffold inspection only supports write actions, received ${command.action}.`);
  }

  const hostKind = requireField(command.hostKind, 'host-kind');
  const name = requireField(command.name, 'name');
  const toolInput = buildScaffoldWorkflowToolInput(goal);
  const bundle =
    hostKind === 'package'
      ? await buildPackageScaffold({
          name,
          templateId: command.templateId,
          mode: 'write',
          targetRoot: command.targetRoot
        })
      : await buildAgentScaffold({
          name,
          templateId: command.templateId,
          mode: 'write',
          targetRoot: command.targetRoot
        });
  const inspection = await inspectScaffoldTarget({
    bundle,
    targetRoot: command.targetRoot
  });

  return {
    toolInput,
    bundle,
    inspection
  };
}

function tokenizeScaffoldGoal(value: string) {
  return value.match(/"[^"]*"|'[^']*'|`[^`]*`|[^\s]+/g)?.map(stripQuotes) ?? [];
}

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('`') && value.endsWith('`'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function nextToken(tokens: string[], index: number, option: string) {
  const value = tokens[index];
  if (!value) {
    throw new Error(`Missing value for /scaffold ${option}`);
  }
  return value;
}

function parseHostKind(value: string): ScaffoldHostKind {
  if (value === 'package' || value === 'agent') {
    return value;
  }
  throw new Error(`Invalid /scaffold --host-kind: ${value}`);
}

function parseTemplateId(value: string): ScaffoldTemplateId {
  if (value === 'package-lib' || value === 'agent-basic') {
    return value;
  }
  throw new Error(`Invalid /scaffold --template-id: ${value}`);
}

function requireField<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required /scaffold --${field}`);
  }
  return value;
}
