import { Anchor, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { gdsAccentPanel } from '../../lib/ui/gdsSurfaces';

/**
 * @param {{ links?: object, title?: string }} props
 * links shape from GET /api/intelligence/status (links.flattened)
 */
export function LocalAiQuickLinks({ links, title = 'Quick links' }) {
  const items = links?.flattened || [];
  if (!items.length) return null;

  return (
    <Paper p="md" withBorder style={gdsAccentPanel.default}>
      <Title order={5} mb="sm">
        {title}
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {items.map((item) => (
          <Stack key={item.url} gap={2}>
            <Anchor href={item.url} target="_blank" rel="noreferrer" size="sm" fw={500}>
              {item.label}
            </Anchor>
            {item.description ? (
              <Text size="xs" c="dimmed">
                {item.description}
              </Text>
            ) : null}
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  );
}
