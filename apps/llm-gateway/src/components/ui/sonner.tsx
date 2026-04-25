'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'border-border bg-background text-foreground',
          description: 'text-muted-foreground'
        }
      }}
      {...props}
    />
  );
}
