import { z } from 'zod';

export const RunStageSchema = z.enum([
  'plan',
  'route',
  'research',
  'execution',
  'review',
  'delivery',
  'interrupt',
  'recover',
  'learning'
]);

export const RunStageStatusSchema = z.enum(['pending', 'running', 'completed', 'blocked', 'failed', 'skipped']);

export const RunSpanStatusSchema = z.enum(['started', 'completed', 'failed', 'cancelled', 'blocked', 'fallback']);

export const RunDiagnosticKindSchema = z.enum([
  'stuck',
  'fallback',
  'approval_blocked',
  'budget_exceeded',
  'evidence_insufficient',
  'recoverable_failure',
  'schema_retry',
  'tool_failure',
  'stream_gap',
  'governance_block'
]);

export const RunDiagnosticSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const RunRecoverabilitySchema = z.enum(['none', 'partial', 'safe']);
