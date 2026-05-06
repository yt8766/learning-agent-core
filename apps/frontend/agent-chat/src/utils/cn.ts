import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class strings; duplicate utilities resolve to last intent. */
export function cn(...inputs: Array<string | undefined | false | null>): string {
  return twMerge(inputs.filter(Boolean).join(' '));
}
