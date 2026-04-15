import type { ChatMessage, GenerateTextOptions } from '../../adapters/llm/llm-provider';
import { withLlmRetry } from '../../utils/retry';
import { DATA_REPORT_SANDPACK_SYSTEM_PROMPT, formatDataReportSandpackRetryFeedback } from './prompts';
import { parseDataReportSandpackPayload } from './schemas';
import type {
  DataReportSandpackFiles,
  DataReportSandpackGenerateInput,
  DataReportSandpackGenerateResult,
  DataReportSandpackPayload
} from '../../types/data-report';

export { DATA_REPORT_SANDPACK_SYSTEM_PROMPT, formatDataReportSandpackRetryFeedback } from './prompts';
export { parseDataReportSandpackPayload } from './schemas';
export type {
  DataReportPreviewStage,
  DataReportSandpackFiles,
  DataReportSandpackGenerateInput,
  DataReportSandpackGenerateResult,
  DataReportSandpackPayload,
  DataReportSandpackStage
} from '../../types/data-report';

export class DataReportSandpackAgent {
  isTruncationError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /truncated before the json completed|unexpected end of json input|unterminated/i.test(message);
  }

  buildMessages(input: { goal: string; systemPrompt?: string; contextBlock?: string }): ChatMessage[] {
    return [
      { role: 'system', content: DATA_REPORT_SANDPACK_SYSTEM_PROMPT },
      ...(input.systemPrompt?.trim() ? [{ role: 'system' as const, content: input.systemPrompt.trim() }] : []),
      {
        role: 'user',
        content: [input.goal, input.contextBlock?.trim()].filter(Boolean).join('\n\n')
      }
    ];
  }

  async generate(input: DataReportSandpackGenerateInput): Promise<DataReportSandpackGenerateResult> {
    const messages = this.buildMessages({
      goal: input.goal,
      systemPrompt: input.systemPrompt,
      contextBlock: input.contextBlock
    });
    const options: GenerateTextOptions = {
      role: 'manager',
      modelId: input.modelId,
      temperature: typeof input.temperature === 'number' ? input.temperature : 0.2,
      maxTokens: typeof input.maxTokens === 'number' ? input.maxTokens : undefined
    };

    return withLlmRetry(
      async currentMessages => {
        const content = await input.llm.streamText(currentMessages, options, token => {
          input.onToken?.(token);
        });

        return {
          content,
          payload: this.parsePayload(content)
        };
      },
      messages,
      {
        onRetry: input.onRetry,
        formatErrorFeedback: formatDataReportSandpackRetryFeedback
      }
    );
  }

  parsePayload(content: string): DataReportSandpackPayload {
    const trimmed = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const maybeTruncated = /unexpected end of json input|unterminated/i.test(message);
      throw new Error(
        maybeTruncated
          ? `Sandpack JSON parse failed: ${message}. The model output may have been truncated before the JSON completed.`
          : `Sandpack JSON parse failed: ${message}`
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Sandpack response must be a JSON object.');
    }

    const schemaPayload = parseDataReportSandpackPayload(parsed);
    const normalizedFiles = schemaPayload.files;
    this.validateFiles(normalizedFiles);

    return {
      status: schemaPayload.status,
      files: normalizedFiles
    };
  }

  validateFiles(files: DataReportSandpackFiles) {
    const filePaths = Object.keys(files);
    const appPath = files['/App.tsx'] ? '/App.tsx' : files['/src/App.tsx'] ? '/src/App.tsx' : null;
    if (filePaths.length < 1) {
      throw new Error('Invalid Sandpack format: response must include generated files.');
    }
    if (!appPath) {
      throw new Error('Invalid Sandpack format: response must include /App.tsx.');
    }

    const hasDataDashboardPage = filePaths.some(filePath =>
      /^\/(?:src\/)?pages\/dataDashboard\/[A-Za-z][A-Za-z0-9]*\/index\.tsx$/.test(filePath)
    );
    if (!hasDataDashboardPage) {
      throw new Error('Invalid Sandpack format: missing /src/pages/dataDashboard/<englishName>/index.tsx page file.');
    }

    const hasDataService = filePaths.some(filePath =>
      /^\/(?:src\/)?services\/data\/[A-Za-z][A-Za-z0-9]*\.ts$/.test(filePath)
    );
    if (!hasDataService) {
      throw new Error('Invalid Sandpack format: missing /src/services/data/<englishName>.ts service file.');
    }

    const hasDataTypes = filePaths.some(filePath =>
      /^\/(?:src\/)?types\/data\/[A-Za-z][A-Za-z0-9]*\.ts$/.test(filePath)
    );
    if (!hasDataTypes) {
      throw new Error('Invalid Sandpack format: missing /src/types/data/<englishName>.ts types file.');
    }

    const forbiddenHookImport = Object.values(files).find(code =>
      /@\/hooks\/useExport\b|@\/hooks\/useExportWithAudit\b|\buseExportWithAudit\b|\buseExport\b/.test(code)
    );
    if (forbiddenHookImport) {
      throw new Error(
        'Invalid Sandpack format: generated files must not import useExport/useExportWithAudit or any @/hooks/useExport* alias.'
      );
    }
  }
}

export const dataReportSandpackAgent = new DataReportSandpackAgent();
