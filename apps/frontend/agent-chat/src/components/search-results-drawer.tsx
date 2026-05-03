import { Drawer, Typography } from 'antd';

const { Text, Title } = Typography;

export interface SearchResultSource {
  id: string;
  sourceUrl?: string;
  sourceType: string;
  summary: string;
  detail?: Record<string, unknown>;
  createdAt?: string;
}

export interface SearchResultsDrawerProps {
  open: boolean;
  onClose: () => void;
  sources: SearchResultSource[];
  highlightId?: string;
}

export function SearchResultsDrawer({ open, onClose, sources, highlightId }: SearchResultsDrawerProps) {
  const webSources = sources.filter(s => s.sourceType === 'web' && s.sourceUrl);

  return (
    <Drawer
      title="搜索结果"
      placement="right"
      width={380}
      open={open}
      onClose={onClose}
      className="chatx-search-results-drawer"
      destroyOnClose
    >
      <div className="chatx-search-results-drawer__list">
        {webSources.length === 0 ? (
          <Text type="secondary">暂无网页搜索结果</Text>
        ) : (
          webSources.map(source => {
            let host = '';
            let date = '';
            try {
              host = new URL(source.sourceUrl!).hostname;
            } catch {
              /* ignore */
            }
            if (source.createdAt) {
              try {
                date = new Date(source.createdAt).toLocaleDateString('zh-CN');
              } catch {
                /* ignore */
              }
            }

            return (
              <article
                key={source.id}
                className={`chatx-search-results-drawer__card ${source.id === highlightId ? 'is-highlighted' : ''}`}
              >
                <div className="chatx-search-results-drawer__card-header">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${host}&sz=16`}
                    alt=""
                    width={14}
                    height={14}
                    className="chatx-search-results-drawer__favicon"
                  />
                  <Text type="secondary" className="chatx-search-results-drawer__host">
                    {host}
                  </Text>
                  {date ? (
                    <Text type="secondary" className="chatx-search-results-drawer__date">
                      {date}
                    </Text>
                  ) : null}
                </div>
                <Title level={5} className="chatx-search-results-drawer__title">
                  <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {source.summary}
                  </a>
                </Title>
                {typeof source.detail?.excerpt === 'string' ? (
                  <Text type="secondary" className="chatx-search-results-drawer__excerpt">
                    {source.detail.excerpt}
                  </Text>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </Drawer>
  );
}
