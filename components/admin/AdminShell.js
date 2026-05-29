import Link from 'next/link';
import { AppShell } from '@doneisbetter/gds-admin/client';
import { Text } from '@doneisbetter/gds-core/client';

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
      {children}
    </AppShell>
  );
}
