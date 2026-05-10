import type { GatewayQuotaDetailListResponse } from '@agent/core';

interface QuotaDetailPageProps {
  details: GatewayQuotaDetailListResponse;
  onRefreshProvider?: (providerId: string) => void;
}

export function QuotaDetailPage({ details, onRefreshProvider }: QuotaDetailPageProps) {
  return (
    <section className="page-stack" aria-label="Quota Detail">
      <div className="section-heading">
        <h2>Quota Detail</h2>
        <p>Provider-specific quota projection normalized from management api-call.</p>
      </div>

      {details.items.map(item => (
        <article className="detail-panel" key={item.id}>
          <h3>{item.providerId}</h3>
          <p>
            {item.model} · {item.scope} · {item.status}
          </p>
          <p>
            {item.used} / {item.limit}
          </p>
          <button type="button" onClick={() => onRefreshProvider?.(item.providerId)}>
            Refresh provider quota
          </button>
        </article>
      ))}
    </section>
  );
}
