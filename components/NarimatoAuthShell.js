import { Center, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { NarimatoThemeToggle } from './NarimatoThemeToggle';

/**
 * Auth shell contract for login and account entry surfaces (GDS COMPONENTS §6).
 */
export function NarimatoAuthShell({ title, subtitle, children }) {
  return (
    <Center mih="100vh" p="md" pos="relative">
      <Group pos="absolute" top="md" right="md">
        <NarimatoThemeToggle size="md" />
      </Group>
      <Paper withBorder p="xl" radius="md" w="100%" maw={420}>
        <Stack gap="md">
          <Title order={2}>{title}</Title>
          {subtitle ? (
            <Text c="dimmed" size="sm">
              {subtitle}
            </Text>
          ) : null}
          {children}
        </Stack>
      </Paper>
    </Center>
  );
}
