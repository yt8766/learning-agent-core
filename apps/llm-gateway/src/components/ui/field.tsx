import * as React from 'react';

import { cn } from '@/lib/utils';

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-6', className)} data-slot="field-group" {...props} />;
}

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-3', className)} data-slot="field" role="group" {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      data-slot="field-label"
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:underline', className)}
      data-slot="field-description"
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldGroup, FieldLabel };
