import Link from 'next/link';
import { AppShell } from '@doneisbetter/gds-admin/client';

export function AdminShell({ title = 'Admin', children }) {
  return (
    <AppShell
      logoText={title}
      headerContext="Narimato administration"
      headerActions={
        <Link href="/" style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)', textDecoration: 'none' }}>
          Public site
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
