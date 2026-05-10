export interface ParsedKnowledgeCliArgs {
  command: 'index' | 'retrieval' | 'ask' | 'help';
  options: Record<string, string | boolean>;
}

const COMMANDS = new Set(['index', 'retrieval', 'ask', 'help']);

export function parseKnowledgeCliArgs(argv: string[]): ParsedKnowledgeCliArgs {
  const normalizedArgv = stripLeadingArgumentSeparators(argv);
  const [maybeCommand, ...rest] = normalizedArgv;
  const command = COMMANDS.has(maybeCommand ?? '') ? maybeCommand! : maybeCommand ? 'ask' : 'help';
  const tokens = COMMANDS.has(maybeCommand ?? '') ? rest : normalizedArgv;
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token?.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }

  return { command: command as ParsedKnowledgeCliArgs['command'], options };
}

function stripLeadingArgumentSeparators(argv: string[]): string[] {
  let index = 0;
  while (argv[index] === '--') {
    index += 1;
  }
  return argv.slice(index);
}

export function readStringOption(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function readIntegerOption(options: Record<string, string | boolean>, key: string, fallback: number): number {
  const value = readStringOption(options, key);
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readBooleanOption(options: Record<string, string | boolean>, key: string): boolean {
  return options[key] === true || options[key] === 'true';
}
