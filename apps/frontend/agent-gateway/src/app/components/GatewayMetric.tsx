interface GatewayMetricProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function GatewayMetric({ label, value, detail }: GatewayMetricProps) {
  return (
    <article className="gateway-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
