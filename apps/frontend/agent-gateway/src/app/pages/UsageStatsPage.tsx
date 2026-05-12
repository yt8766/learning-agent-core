import { useMemo, useState } from 'react';
import { Activity, CalendarDays, Database, DollarSign, Layers3, RefreshCw, Search, X } from 'lucide-react';
import type { GatewayUsageAnalyticsResponse } from '@agent/core';
import {
  ModelStatsTable,
  ProviderStatsTable,
  RequestLogTable,
  SummaryCard,
  TrendChart
} from './usage-stats-page.components';
import {
  compactThousands,
  describeRange,
  formatInteger,
  formatUsd,
  includesText,
  TAB_ITEMS,
  type UsageTab
} from './usage-stats-page.model';

interface UsageStatsPageProps {
  analytics: GatewayUsageAnalyticsResponse;
  onRefresh?: () => void;
}

export function UsageStatsPage({ analytics, onRefresh }: UsageStatsPageProps) {
  const [activeProvider, setActiveProvider] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<UsageTab>('requestLogs');
  const [providerSearch, setProviderSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const filteredLogs = useMemo(
    () =>
      analytics.requestLogs.items.filter(
        item =>
          (activeProvider === 'all' || item.providerId === activeProvider) &&
          includesText(item.providerName, providerSearch) &&
          includesText(item.model ?? '', modelSearch)
      ),
    [activeProvider, analytics.requestLogs.items, modelSearch, providerSearch]
  );
  const filteredProviders = useMemo(
    () =>
      analytics.providerStats.filter(
        item =>
          (activeProvider === 'all' || item.providerId === activeProvider) &&
          includesText(item.providerName, providerSearch)
      ),
    [activeProvider, analytics.providerStats, providerSearch]
  );
  const filteredModels = useMemo(
    () =>
      analytics.modelStats.filter(
        item =>
          (activeProvider === 'all' || item.providerId === activeProvider) &&
          includesText(item.model, modelSearch || providerSearch)
      ),
    [activeProvider, analytics.modelStats, modelSearch, providerSearch]
  );

  return (
    <section className="usage-page" aria-label="使用统计">
      <header className="usage-header">
        <div>
          <h1>使用统计</h1>
          <p>查看 AI 模型的使用情况和成本统计</p>
        </div>
      </header>

      <div className="usage-toolbar">
        <div className="usage-provider-tabs" aria-label="供应商筛选">
          <button
            className={`usage-provider-tab${activeProvider === 'all' ? ' active' : ''}`}
            onClick={() => setActiveProvider('all')}
            type="button"
          >
            全部
          </button>
          {analytics.filters.providers.map(provider => (
            <button
              className={`usage-provider-tab${activeProvider === provider.id ? ' active' : ''}`}
              key={provider.id}
              onClick={() => setActiveProvider(provider.id)}
              type="button"
            >
              {provider.label}
            </button>
          ))}
        </div>
        <div className="usage-toolbar-actions">
          <button className="usage-icon-button" onClick={onRefresh} title="刷新" type="button">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <span className="usage-toolbar-divider">--</span>
          <span className="usage-date-pill">
            <CalendarDays size={17} aria-hidden="true" />
            {describeRange(analytics.range.preset)}
          </span>
        </div>
      </div>

      <div className="usage-summary-grid">
        <SummaryCard
          icon={<Activity size={24} />}
          label="总请求数"
          value={formatInteger(analytics.summary.requestCount)}
          tone="blue"
        />
        <SummaryCard
          icon={<DollarSign size={24} />}
          label="总成本"
          value={formatUsd(analytics.summary.estimatedCostUsd, 4)}
          tone="green"
        />
        <SummaryCard
          detail={[
            ['Input', compactThousands(analytics.summary.inputTokens)],
            ['Output', compactThousands(analytics.summary.outputTokens)]
          ]}
          icon={<Layers3 size={24} />}
          label="总 Token 数"
          tone="purple"
          value={formatInteger(analytics.summary.totalTokens)}
        />
        <SummaryCard
          detail={[
            ['创建', compactThousands(analytics.summary.cacheCreateTokens)],
            ['命中', compactThousands(analytics.summary.cacheHitTokens)]
          ]}
          icon={<Database size={24} />}
          label="缓存 Token"
          tone="orange"
          value={formatInteger(analytics.summary.cacheCreateTokens + analytics.summary.cacheHitTokens)}
        />
      </div>

      <TrendChart analytics={analytics} />

      <div className="usage-tab-strip" role="tablist" aria-label="统计明细">
        {TAB_ITEMS.map(tab => (
          <button
            aria-selected={activeTab === tab.id}
            className={`usage-tab${activeTab === tab.id ? ' active' : ''}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="usage-filter-bar">
        <select aria-label="应用筛选" defaultValue="all">
          <option value="all">全部应用</option>
          {analytics.filters.applications.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select aria-label="状态筛选" defaultValue="all">
          <option value="all">全部</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
        <label className="usage-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            onChange={event => setProviderSearch(event.target.value)}
            placeholder="搜索供应商..."
            type="search"
            value={providerSearch}
          />
        </label>
        <label className="usage-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            onChange={event => setModelSearch(event.target.value)}
            placeholder="搜索模型..."
            type="search"
            value={modelSearch}
          />
        </label>
        <button className="usage-primary-button" onClick={onRefresh} type="button">
          <Search size={18} aria-hidden="true" />
        </button>
        <button
          className="usage-icon-button"
          onClick={() => {
            setProviderSearch('');
            setModelSearch('');
            setActiveProvider('all');
          }}
          title="清除筛选"
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {activeTab === 'requestLogs' ? <RequestLogTable items={filteredLogs} /> : null}
      {activeTab === 'providers' ? <ProviderStatsTable items={filteredProviders} /> : null}
      {activeTab === 'models' ? <ModelStatsTable items={filteredModels} /> : null}
    </section>
  );
}
