import type { ChatThoughtChainItem } from '@agent/core';

import { humanizeOperationalCopy } from '@/pages/chat-home/chat-home-helpers';
import type { WebSearchHit, WorkbenchThoughtProjectionItem } from '@/types/workbench-thought-projection';

function webSearchToHits(item: ChatThoughtChainItem): WebSearchHit[] | undefined {
  const raw = item.webSearch?.hits;
  if (raw?.length) {
    return raw.map(h => ({
      url: h.url,
      title: h.title ?? h.host ?? h.url,
      host:
        h.host ??
        (() => {
          try {
            return new URL(h.url).hostname;
          } catch {
            return '';
          }
        })()
    }));
  }
  const hosts = item.webSearch?.topHosts;
  if (!hosts?.length) {
    return undefined;
  }
  return hosts.map(host => ({ url: `https://${host}`, title: host, host }));
}

function browserToHits(item: ChatThoughtChainItem): WebSearchHit[] | undefined {
  const pages = item.browser?.pages;
  if (!pages?.length) {
    return undefined;
  }
  return pages.map(p => ({
    url: p.url,
    title: p.title ?? p.host ?? p.url,
    host:
      p.host ??
      (() => {
        try {
          return new URL(p.url).hostname;
        } catch {
          return '';
        }
      })()
  }));
}

export function mapThoughtChainToProjectionItems(
  chain: ChatThoughtChainItem[] | undefined
): WorkbenchThoughtProjectionItem[] {
  if (!chain?.length) {
    return [];
  }

  return chain.map(item => {
    const kind = item.kind;
    const hitsFromWeb = kind === 'web_search' ? webSearchToHits(item) : undefined;
    const hitsFromBrowser = kind === 'browser' ? browserToHits(item) : undefined;
    const hits = hitsFromWeb ?? hitsFromBrowser;
    const reasoningContent = item.content ? humanizeOperationalCopy(item.content) : '';
    const useProseContent = kind === 'reasoning' && Boolean(reasoningContent);

    return {
      key: item.key,
      title: humanizeOperationalCopy(item.title),
      description: humanizeOperationalCopy(item.description ?? ''),
      content: useProseContent ? (
        <div className="chatx-thought-prose">{reasoningContent}</div>
      ) : item.content ? (
        <pre className="chatx-thought-raw">{humanizeOperationalCopy(item.content)}</pre>
      ) : undefined,
      footer: item.footer,
      status: item.status,
      collapsible: item.collapsible,
      blink: item.blink,
      itemVariant: item.kind,
      hits
    };
  });
}
