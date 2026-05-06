import * as React from 'react';

import { cn } from '@/utils/utils';

function ScrollArea({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('min-h-0 overflow-auto', className)} {...props}>
      {children}
    </div>
  );
}

export { ScrollArea };
