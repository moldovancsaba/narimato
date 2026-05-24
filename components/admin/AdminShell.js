import Link from 'next/link';
import { AppShell, Container, Group, Text } from '@mantine/core';
import { NarimatoThemeToggle } from '../NarimatoThemeToggle';

export function AdminShell({ title = 'Admin', children }) {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="sm">
            {title}
          </Text>
          <Group gap="sm">
            <NarimatoThemeToggle size="sm" />
            <Text component={Link} href="/" size="xs" c="dimmed" style={{ textDecoration: 'none' }}>
              Public site
            </Text>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="sm" py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
