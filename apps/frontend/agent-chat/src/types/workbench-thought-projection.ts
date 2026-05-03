import type { ReactNode } from 'react';

export interface WebSearchHit {
  url: string;
  title: string;
  host: string;
}

export interface WorkbenchThoughtProjectionItem {
  key: string;
  title: string;
  description?: string;
  content?: ReactNode;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
  itemVariant?: 'reasoning' | 'web_search' | 'browser';
  hits?: WebSearchHit[];
  onOpenSources?: () => void;
}
