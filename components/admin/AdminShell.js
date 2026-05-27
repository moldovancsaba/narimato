import Link from 'next/link';
import { Container, Text } from '@mantine/core';
import { AppShell } from '@doneisbetter/gds-admin/client';

export function AdminShell({ title = 'Admin', children }) {
  return (
    <AppShell
      logoText={title}
      headerContext="Narimato administration"
      headerActions={
        <Text component={Link} href="/" size="xs" c="dimmed" style={{ textDecoration: 'none' }}>
          Public site
        </Text>
      }
    >
      <Container size="sm" py="md">
        {children}
      </Container>
    </AppShell>
  );
}
