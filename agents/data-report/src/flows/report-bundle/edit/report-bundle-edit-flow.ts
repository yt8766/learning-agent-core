import { ReportBundleSchema, type ReportBundle, type ReportDocument, type ReportPatchOperation } from '@agent/core';

import { executeDataReportJsonGraph } from '../../data-report-json/runtime';
import type { DataReportJsonGenerateInput, DataReportJsonGenerateResult } from '../../../types/data-report-json';

export interface ReportBundleEditMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ReportBundleEditInput extends Omit<
  DataReportJsonGenerateInput,
  'goal' | 'currentSchema' | 'reportSchemaInput'
> {
  currentBundle: ReportBundle;
  messages?: ReportBundleEditMessage[];
  requestedOperations?: ReportPatchOperation[];
}

export interface ReportBundleEditResult extends Pick<
  DataReportJsonGenerateResult,
  'status' | 'content' | 'elapsedMs' | 'error' | 'reportSummaries' | 'runtime'
> {
  bundle?: ReportBundle;
  patchOperations?: ReportPatchOperation[];
  primaryDocument?: ReportDocument;
}

function resolvePrimaryDocument(bundle: ReportBundle): ReportDocument {
  const primaryDocument = bundle.documents[0];
  if (!primaryDocument) {
    throw new Error('report bundle edit flow requires at least one current document.');
  }

  return primaryDocument;
}

function resolveMessageRequest(messages?: ReportBundleEditMessage[]) {
  const request = (messages ?? [])
    .map(message => message.content.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return request || undefined;
}

function resolveRequestedOperationsRequest(requestedOperations?: ReportPatchOperation[]) {
  const request = (requestedOperations ?? [])
    .map(operation => operation.summary.trim())
    .filter(Boolean)
    .join('；')
    .trim();

  return request || undefined;
}

function resolveModificationRequest(input: Pick<ReportBundleEditInput, 'messages' | 'requestedOperations'>) {
  return resolveRequestedOperationsRequest(input.requestedOperations) ?? resolveMessageRequest(input.messages);
}

function buildGoal(
  input: Pick<ReportBundleEditInput, 'messages' | 'requestedOperations'>,
  modificationRequest: string
) {
  const messageRequest = resolveMessageRequest(input.messages);
  const requestedOperationsRequest = resolveRequestedOperationsRequest(input.requestedOperations);

  return requestedOperationsRequest && messageRequest
    ? `${requestedOperationsRequest}\n\nCHAT_CONTEXT:\n${messageRequest}`
    : modificationRequest;
}

function buildPatchedBundle(params: {
  currentBundle: ReportBundle;
  primaryDocument: ReportDocument;
  patchOperations?: ReportPatchOperation[];
}) {
  const { currentBundle, primaryDocument, patchOperations } = params;
  const nextDocuments = currentBundle.documents.map((document, index) => (index === 0 ? primaryDocument : document));
  const nextWarnings = Array.from(new Set([...(currentBundle.warnings ?? []), ...(primaryDocument.warnings ?? [])]));

  return ReportBundleSchema.parse({
    ...currentBundle,
    meta: {
      ...currentBundle.meta,
      title: currentBundle.meta.mode === 'single-document' ? primaryDocument.meta.title : currentBundle.meta.title
    },
    documents: nextDocuments,
    patchOperations,
    warnings: nextWarnings.length ? nextWarnings : undefined
  });
}

export async function executeReportBundleEditFlow(input: ReportBundleEditInput): Promise<ReportBundleEditResult> {
  const { currentBundle, messages, requestedOperations, ...jsonInput } = input;
  const parsedCurrentBundle = ReportBundleSchema.parse(currentBundle);
  const modificationRequest = resolveModificationRequest(input);

  if (!modificationRequest) {
    throw new Error('report bundle edit flow requires messages or requestedOperations.');
  }

  const primaryDocument = resolvePrimaryDocument(parsedCurrentBundle);
  const jsonResult = await executeDataReportJsonGraph({
    ...jsonInput,
    goal: buildGoal({ messages, requestedOperations }, modificationRequest),
    currentSchema: primaryDocument,
    modificationRequest
  });

  if (!jsonResult.schema) {
    return {
      status: jsonResult.status,
      content: jsonResult.content,
      elapsedMs: jsonResult.elapsedMs,
      error: jsonResult.error,
      reportSummaries: jsonResult.reportSummaries,
      runtime: jsonResult.runtime
    };
  }

  const bundle = buildPatchedBundle({
    currentBundle: parsedCurrentBundle,
    primaryDocument: jsonResult.schema,
    patchOperations: jsonResult.schema.patchOperations
  });

  return {
    status: jsonResult.status,
    bundle,
    primaryDocument: bundle.documents[0],
    patchOperations: bundle.patchOperations,
    content: jsonResult.content,
    elapsedMs: jsonResult.elapsedMs,
    error: jsonResult.error,
    reportSummaries: jsonResult.reportSummaries,
    runtime: jsonResult.runtime
  };
}
