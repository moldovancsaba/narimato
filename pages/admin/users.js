import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Code,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NarimatoShell } from '../../components/NarimatoShell';
import { getSessionUser } from '../../lib/system/userAuth';

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
      notifications.show({ color: 'green', message: 'User created' });
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
      notifications.show({ color: 'green', message: 'Password regenerated' });
    } catch {
      setError('Network error');
    }
  }

  return (
    <NarimatoShell title="Admin users">
      <Stack gap="lg" maw={640}>
        <Title order={1}>Admin users</Title>

        <Paper withBorder p="md" radius="md">
          <form onSubmit={createUser}>
            <Stack gap="sm">
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Select
                label="Role"
                value={role}
                onChange={setRole}
                data={[
                  { value: 'superadmin', label: 'superadmin' },
                  { value: 'admin', label: 'admin' },
                  { value: 'editor', label: 'editor' },
                ]}
              />
              <Button type="submit">Create user</Button>
            </Stack>
          </form>
        </Paper>

        {error ? (
          <Alert color="red">{error}</Alert>
        ) : null}
        {lastPassword ? (
          <Alert color="dark" title="Generated password">
            <Code>{lastPassword}</Code>
          </Alert>
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
                <Button size="sm" variant="light" onClick={() => regenerate(u.email)}>
                  Regenerate password
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Button component={Link} href="/" variant="default">
          Home
        </Button>
      </Stack>
    </NarimatoShell>
  );
}
