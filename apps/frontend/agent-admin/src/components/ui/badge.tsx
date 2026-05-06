import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors shadow-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#1f1f1d] text-white',
        secondary: 'border-transparent bg-[#ececeb] text-[#5b5b57]',
        success: 'border-transparent bg-[#e7f3eb] text-[#2f6b44]',
        warning: 'border-transparent bg-[#f7edd8] text-[#966a16]',
        destructive: 'border-transparent bg-[#fbe8e5] text-[#b3402e]',
        outline: 'border-[#e5e5e1] bg-white text-muted-foreground',
        ghost: 'border-transparent bg-transparent text-muted-foreground',
        link: 'border-transparent bg-transparent text-foreground underline-offset-4 hover:underline'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
