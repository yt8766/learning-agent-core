import { useState } from 'react';

import type { WebSearchHit, WorkbenchThoughtProjectionItem } from '@/types/workbench-thought-projection';

export interface CognitionThoughtLogProps {
  items: WorkbenchThoughtProjectionItem[];
  variant: 'processing' | 'processed';
}

export function CognitionThoughtLog({ items, variant }: CognitionThoughtLogProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={`chatx-cognition-log is-${variant}`} data-testid="chatx-cognition-log">
      <ol className="chatx-cognition-log__list">
        {items.map(item => (
          <li
            key={item.key}
            className={[
              'chatx-cognition-log__item',
              item.status ? `is-${item.status}` : 'is-loading',
              item.itemVariant === 'web_search' ? 'is-search' : '',
              item.itemVariant === 'browser' ? 'is-browser' : '',
              item.itemVariant === 'reasoning' ? 'is-reasoning' : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span
              className={[
                'chatx-cognition-log__dot',
                item.itemVariant === 'web_search' ? 'is-search-icon' : '',
                item.itemVariant === 'browser' ? 'is-browser-icon' : '',
                item.itemVariant === 'reasoning' ? 'is-reasoning-dot' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            />
            <div className="chatx-cognition-log__body">
              <span className="chatx-cognition-log__title">{item.title}</span>
              {item.description ? <span className="chatx-cognition-log__description">{item.description}</span> : null}
              {item.itemVariant === 'browser' && item.hits?.length ? (
                <BrowserSourceTitles hits={item.hits} />
              ) : item.hits?.length ? (
                <SearchHitPills hits={item.hits} />
              ) : null}
              {item.content ? <div className="chatx-cognition-log__content">{item.content}</div> : null}
              {item.footer ? <span className="chatx-cognition-log__footer">{item.footer}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const MAX_VISIBLE_HITS = 4;
const MAX_VISIBLE_TITLES = 5;

function faviconDomain(hit: WebSearchHit): string {
  if (hit.host) {
    return hit.host;
  }
  try {
    return new URL(hit.url).hostname;
  } catch {
    return '';
  }
}

function SearchHitPills({ hits }: { hits: WebSearchHit[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? hits : hits.slice(0, MAX_VISIBLE_HITS);
  const overflow = hits.length - Math.min(hits.length, MAX_VISIBLE_HITS);

  return (
    <div className="chatx-cognition-log__hits">
      {visible.map(hit => (
        <a
          key={hit.url}
          className="chatx-cognition-log__hit-pill"
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          title={hit.title}
        >
          <img
            className="chatx-cognition-log__hit-favicon"
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(faviconDomain(hit) || 'localhost')}&sz=16`}
            alt=""
            width={14}
            height={14}
          />
          <span className="chatx-cognition-log__hit-label">
            {[hit.title && hit.title !== hit.host ? hit.title : null, hit.host].filter(Boolean).join(' · ') || hit.url}
          </span>
        </a>
      ))}
      {!expanded && overflow > 0 ? (
        <button
          type="button"
          className="chatx-cognition-log__hit-pill chatx-cognition-log__hit-more"
          onClick={() => setExpanded(true)}
        >
          查看全部
        </button>
      ) : null}
    </div>
  );
}

function BrowserSourceTitles({ hits }: { hits: WebSearchHit[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? hits.length : MAX_VISIBLE_TITLES;
  const visible = hits.slice(0, limit);
  const overflow = hits.length - MAX_VISIBLE_TITLES;

  return (
    <ul className="chatx-cognition-log__page-list">
      {visible.map(hit => (
        <li key={hit.url} className="chatx-cognition-log__page-list-item">
          <a href={hit.url} target="_blank" rel="noopener noreferrer" className="chatx-cognition-log__page-link">
            {hit.title || hit.host || hit.url}
          </a>
        </li>
      ))}
      {!expanded && overflow > 0 ? (
        <li className="chatx-cognition-log__page-list-item">
          <button type="button" className="chatx-cognition-log__page-more" onClick={() => setExpanded(true)}>
            查看全部
          </button>
        </li>
      ) : null}
    </ul>
  );
}
