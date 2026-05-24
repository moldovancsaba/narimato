import { Paper, Stack, Text } from '@mantine/core';
import { StatusBadge } from '@gds/core';

/**
 * GDS metric-card pattern for Narimato dashboards (label + value + optional status).
 */
export function NarimatoMetricCard({ label, value, hint, status, children }) {
  return (
    <Paper withBorder p="md" radius="md" h="100%">
      <Stack gap={6} h="100%" justify="space-between">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" lh={1.2}>
            {label}
          </Text>
          {status ? (
            <StatusBadge status={status} size="lg">
              {value}
            </StatusBadge>
          ) : (
            <Text size="xl" fw={700} lh={1.2}>
              {value}
            </Text>
          )}
          {hint ? (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
