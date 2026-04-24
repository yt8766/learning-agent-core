import type {
  ModelInvocationPostprocessor,
  ModelInvocationPostprocessorContext,
  TraceAuditPostprocessorResult
} from '../model-invocation.types';
import { buildModelInvocationTraceSummary as buildTraceSummary } from '../model-invocation.types';

export class TraceAuditPostprocessor implements ModelInvocationPostprocessor<TraceAuditPostprocessorResult> {
  readonly name = 'trace-audit';

  run({ request, decision, providerResult }: ModelInvocationPostprocessorContext): TraceAuditPostprocessorResult {
    return {
      traceSummary: buildTraceSummary({
        request,
        decision,
        providerId: providerResult.providerId ?? 'unknown-provider'
      })
    };
  }
}
