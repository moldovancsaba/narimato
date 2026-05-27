import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code, Group, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { FormField, PageHeader, SemanticButton, StateBlock } from '@doneisbetter/gds-core/client';
import { AdminShell } from '../../components/admin/AdminShell';
import { getSessionUser } from '../../lib/system/userAuth';
import { showSuccessNotification } from '../../lib/ui/notifications';

export async function getServerSideProps(ctx) {
  const user = getSessionUser(ctx.req);
  if (!user) {
    const next = encodeURIComponent(ctx.resolvedUrl || '/admin/users');
    return { redirect: { destination: `/admin/login?next=${next}`, permanent: false } };
  }
  return { props: {} };
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [lastPassword, setLastPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        if (!res.ok) {
          const next = encodeURIComponent('/admin/users');
          window.location.href = `/admin/login?next=${next}`;
          return;
        }
        const list = await fetch('/api/admin/users');
        if (list.ok) {
          const data = await list.json();
          setUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        setError('Failed to load users');
      }
    })();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setLastPassword('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      setLastPassword(data.password || '');
      setEmail('');
      showSuccessNotification('User created');
      const list = await fetch('/api/admin/users');
      if (list.ok) setUsers((await list.json()).users || []);
    } catch {
      setError('Network error');
    }
  }

  async function regenerate(userEmail) {
    setError('');
    setLastPassword('');
    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to regenerate password');
        return;
      }
      setLastPassword(data.password || '');
      showSuccessNotification('Password regenerated');
    } catch {
      setError('Network error');
    }
  }

  return (
    <AdminShell title="Admin users">
      <Stack gap="lg" maw={640}>
        <PageHeader title="Admin users" />

        <Paper withBorder p="md" radius="md">
          <form onSubmit={createUser}>
            <Stack gap="sm">
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Role">
                <Select
                  value={role}
                  onChange={setRole}
                  data={[
                    { value: 'superadmin', label: 'superadmin' },
                    { value: 'admin', label: 'admin' },
                    { value: 'editor', label: 'editor' },
                  ]}
                />
              </FormField>
              <SemanticButton type="submit" action="add" />
            </Stack>
          </form>
        </Paper>

        {error ? <StateBlock variant="error" title="Unable to complete admin action" description={error} compact /> : null}
        {lastPassword ? (
          <Stack gap="xs">
            <StateBlock
              variant="info"
              title="Generated password"
              description="Copy and store this password securely."
              compact
            />
            <Code>{lastPassword}</Code>
          </Stack>
        ) : null}

        <Title order={2}>Existing users</Title>
        <Stack gap="sm">
          {users.map((u) => (
            <Paper key={u.email} withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{u.email}</Text>
                  <Text size="sm" c="dimmed">
                    {u.role}
                  </Text>
                </div>
                <SemanticButton
                  action="refresh"
                  size="sm"
                  variant="light"
                  onClick={() => regenerate(u.email)}
                />
              </Group>
            </Paper>
          ))}
        </Stack>

        <SemanticButton action="home" component={Link} href="/" variant="default" />
      </Stack>
    </AdminShell>
  );
}
