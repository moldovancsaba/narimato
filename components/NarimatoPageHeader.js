import { Group, Stack, Text, Title } from '@mantine/core';

/**
 * Thin local PageHeader contract (GDS TEMPLATES/AppPageHeader.tsx.template).
 */
export function NarimatoPageHeader({ title, subtitle, actions }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="lg">
      <Stack gap={4}>
        <Title order={1}>{title}</Title>
        {subtitle ? <Text c="dimmed">{subtitle}</Text> : null}
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  );
}
