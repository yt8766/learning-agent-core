import * as React from 'react';

import { cn } from '@/lib/utils';

function ScrollArea({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('min-h-0 overflow-auto', className)} {...props}>
      {children}
    </div>
  );
}

export { ScrollArea };
