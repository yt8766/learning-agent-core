import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

interface ZodValidationSchema<TInput, TOutput> {
  safeParse(value: TInput): { success: true; data: TOutput } | { success: false; error: { issues: unknown[] } };
}

@Injectable()
export class ZodValidationPipe<TInput = unknown, TOutput = unknown> implements PipeTransform<TInput, TOutput> {
  constructor(private readonly schema: ZodValidationSchema<TInput, TOutput>) {}

  transform(value: TInput): TOutput {
    const parsed = this.schema.safeParse(value);
    if (parsed.success === false) {
      throw new BadRequestException({
        code: 'schema_validation_failed',
        issues: parsed.error.issues
      });
    }

    return parsed.data;
  }
}
