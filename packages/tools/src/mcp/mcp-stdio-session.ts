import { spawn } from 'node:child_process';

import type { McpServerDefinition } from './mcp-server-registry';

export interface StdioPendingWaiter {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

export interface StdioSessionRecord {
  child: ReturnType<typeof spawn>;
  pending: Map<number, StdioPendingWaiter>;
  nextId: number;
  stdoutBuffer: string;
  stderrBuffer: string;
  initialized: Promise<void>;
  createdAt: string;
  lastActivityAt: string;
  requestCount: number;
  close: () => void;
}

export interface StdioSessionClient {
  send: (message: Record<string, unknown>) => void;
  awaitResponse: (id: number, timeoutMs: number) => Promise<unknown>;
  nextId: () => number;
  close: () => void;
}

export function createStdioSessionClient(session: StdioSessionRecord): StdioSessionClient {
  return {
    send: (message: Record<string, unknown>) => {
      const stdin = session.child.stdin;
      if (!stdin) {
        throw new Error('stdio_stdin_unavailable');
      }
      session.lastActivityAt = new Date().toISOString();
      session.requestCount += 1;
      stdin.write(`${JSON.stringify(message)}\n`);
    },
    awaitResponse: (id: number, timeoutMs: number) =>
      new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          session.pending.delete(id);
          reject(new Error(`stdio_timeout_${id}`));
        }, timeoutMs);
        session.pending.set(id, {
          resolve: value => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: reason => {
            clearTimeout(timeout);
            reject(reason);
          },
          timeout
        });
      }),
    nextId: () => session.nextId++,
    close: session.close
  };
}

export function createStdioSession(
  server: McpServerDefinition,
  onClose: () => void
): { session: StdioSessionRecord; child: ReturnType<typeof spawn> } {
  const child = spawn(server.command!, server.args ?? [], {
    env: {
      ...process.env,
      ...(server.env ?? {})
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const session: StdioSessionRecord = {
    child,
    pending: new Map<number, StdioPendingWaiter>(),
    nextId: 1,
    stdoutBuffer: '',
    stderrBuffer: '',
    initialized: Promise.resolve(),
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    requestCount: 0,
    close: () => {
      child.stdin.end();
      child.kill('SIGTERM');
      for (const [, waiter] of session.pending) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('stdio_session_closed'));
      }
      session.pending.clear();
      onClose();
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    session.stdoutBuffer += chunk;
    let newlineIndex = session.stdoutBuffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = session.stdoutBuffer.slice(0, newlineIndex).trim();
      session.stdoutBuffer = session.stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        try {
          const message = JSON.parse(line) as {
            id?: number;
            result?: unknown;
            error?: { message?: string };
          };
          if (typeof message.id === 'number' && session.pending.has(message.id)) {
            const waiter = session.pending.get(message.id)!;
            session.pending.delete(message.id);
            if (message.error) {
              waiter.reject(new Error(message.error.message ?? 'stdio_mcp_error'));
            } else {
              waiter.resolve(message.result);
            }
          }
        } catch {
          session.stderrBuffer += `\ninvalid_stdout:${line}`;
        }
      }
      newlineIndex = session.stdoutBuffer.indexOf('\n');
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    session.stderrBuffer += chunk;
  });
  child.on('exit', () => {
    session.close();
  });
  child.on('error', error => {
    session.stderrBuffer += `\nspawn_error:${error.message}`;
    session.close();
  });

  return { session, child };
}

export function extractStdioContentText(result: {
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
  [key: string]: unknown;
}): string {
  return Array.isArray(result?.content)
    ? result.content
        .map(item => (typeof item?.text === 'string' ? item.text : undefined))
        .filter((item): item is string => Boolean(item))
        .join('\n')
    : '';
}
