import { MetricCard, StatusBadge } from '@doneisbetter/gds-core/server';

/**
 * Narimato adapter for GDS MetricCard (label + value + optional status/hint).
 */
export function NarimatoMetricCard({ label, value, hint, status, children }) {
  const displayValue = status ? (
    <StatusBadge status={status} size="lg">
      {value}
    </StatusBadge>
  ) : (
    value
  );

  return (
    <MetricCard label={label} value={displayValue} description={hint} footer={children} />
  );
}
