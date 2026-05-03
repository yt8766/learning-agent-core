import type { AgentToolAlias, AgentToolAliasRequest } from '../index';

export interface NormalizedAgentToolInput {
  toolName: string;
  input: Record<string, unknown>;
  reasonCode: string;
  reason: string;
  inputPreview?: string;
}

export function normalizeAgentToolInput(request: AgentToolAliasRequest): NormalizedAgentToolInput {
  switch (request.alias) {
    case 'read':
      return normalizeReadInput(request);
    case 'list':
      return normalizePathOnlyInput(request.alias, 'list_directory', request, 'alias_list_directory');
    case 'search':
      return {
        toolName: 'search_in_files',
        input: {
          query: requireString(request.input.query, 'query'),
          basePath: stringOrUndefined(request.input.basePath),
          filePattern: stringOrUndefined(request.input.filePattern),
          limit: numberOrUndefined(request.input.limit)
        },
        inputPreview: `search ${String(request.input.query)}`,
        reasonCode: 'alias_search_files',
        reason: 'Resolved search alias to search_in_files.'
      };
    case 'write':
      return normalizeWriteInput(request);
    case 'edit':
      return {
        toolName: 'patch_local_file',
        input: {
          path: requireString(request.input.path, 'path'),
          search: requireString(request.input.search, 'search'),
          replace: requireString(request.input.replace, 'replace'),
          all: request.input.all === true
        },
        inputPreview: `edit ${String(request.input.path)}`,
        reasonCode: 'alias_edit_patch',
        reason: 'Resolved edit alias to patch_local_file.'
      };
    case 'delete':
      return {
        toolName: 'delete_local_file',
        input: {
          path: requireString(request.input.path, 'path'),
          recursive: request.input.recursive === true
        },
        inputPreview: `delete ${String(request.input.path)}`,
        reasonCode: 'alias_delete_file',
        reason: 'Resolved delete alias to delete_local_file.'
      };
    case 'command':
      return {
        toolName: 'run_terminal',
        input: {
          command: requireString(request.input.command, 'command'),
          goal: stringOrUndefined(request.input.goal)
        },
        inputPreview: `command ${String(request.input.command).slice(0, 160)}`,
        reasonCode: 'alias_command_terminal',
        reason: 'Resolved command alias to run_terminal.'
      };
    default:
      return assertNeverAlias(request.alias);
  }
}

function normalizeReadInput(request: AgentToolAliasRequest): NormalizedAgentToolInput {
  const path = requireString(request.input.path, 'path');
  const structured = request.input.structured === true;
  return {
    toolName: structured && path.endsWith('.json') ? 'read_json' : 'read_local_file',
    input: { path },
    inputPreview: `read ${path}`,
    reasonCode: structured && path.endsWith('.json') ? 'alias_read_json' : 'alias_read_file',
    reason:
      structured && path.endsWith('.json')
        ? 'Resolved read alias to read_json.'
        : 'Resolved read alias to read_local_file.'
  };
}

function normalizeWriteInput(request: AgentToolAliasRequest): NormalizedAgentToolInput {
  const path = requireString(request.input.path, 'path');
  if ('value' in request.input && path.endsWith('.json')) {
    return {
      toolName: 'write_json',
      input: {
        path,
        value: request.input.value,
        spacing: numberOrUndefined(request.input.spacing)
      },
      inputPreview: `write json ${path}`,
      reasonCode: 'alias_write_json',
      reason: 'Resolved write alias to write_json.'
    };
  }

  return {
    toolName: 'write_local_file',
    input: {
      path,
      content: requireString(request.input.content, 'content')
    },
    inputPreview: `write ${path}`,
    reasonCode: 'alias_write_file',
    reason: 'Resolved write alias to write_local_file.'
  };
}

function normalizePathOnlyInput(
  alias: AgentToolAlias,
  toolName: string,
  request: AgentToolAliasRequest,
  reasonCode: string
): NormalizedAgentToolInput {
  const path = typeof request.input.path === 'string' && request.input.path.trim() ? request.input.path : '.';
  return {
    toolName,
    input: { path },
    inputPreview: `${alias} ${path}`,
    reasonCode,
    reason: `Resolved ${alias} alias to ${toolName}.`
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  throw new Error(`agent_tool_alias_input_invalid:${field}`);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function assertNeverAlias(alias: never): never {
  throw new Error(`agent_tool_alias_invalid:${alias}`);
}
