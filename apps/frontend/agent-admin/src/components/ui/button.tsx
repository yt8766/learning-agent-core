import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-none',
  {
    variants: {
      variant: {
        default: 'bg-[#1f1f1d] text-white hover:bg-[#2a2a28]',
        secondary: 'border border-[#e5e5e1] bg-white text-foreground hover:bg-[#f3f3f1]',
        ghost: 'bg-transparent text-muted-foreground hover:bg-[#f3f3f1] hover:text-foreground',
        destructive: 'bg-[#b3402e] text-white hover:bg-[#9f3727]',
        outline: 'border border-[#e5e5e1] bg-white text-foreground hover:bg-[#f3f3f1]',
        link: 'text-foreground underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
