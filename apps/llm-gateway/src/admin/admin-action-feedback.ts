'use client';

import { toast } from 'sonner';

export interface AdminActionFeedbackMessages {
  loading?: string;
  success: string;
  error: string;
}

export async function runAdminActionWithFeedback<T>(
  action: () => Promise<T>,
  messages: AdminActionFeedbackMessages,
  onError?: (message: string) => void
): Promise<T> {
  const promise = action();

  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: error => {
      const message = adminActionErrorMessage(error, messages.error);
      onError?.(message);
      return message;
    }
  });

  return promise;
}

export function adminActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
