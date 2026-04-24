import type {
  ModelInvocationPostprocessor,
  ModelInvocationPostprocessorContext,
  OutputFinalizePostprocessorResult
} from '../model-invocation.types';

export class OutputFinalizePostprocessor implements ModelInvocationPostprocessor<OutputFinalizePostprocessorResult> {
  readonly name = 'output-finalize';

  run({ providerResult }: ModelInvocationPostprocessorContext): OutputFinalizePostprocessorResult {
    // Provider execution currently exposes only stable text output.
    return {
      finalOutput: {
        kind: 'text',
        text: providerResult.outputText
      },
      deliveryMeta: providerResult.deliveryMeta ?? {}
    };
  }
}
