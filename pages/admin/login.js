import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/login');
        if (res.ok) {
          const next = router.query.next || '/admin/users';
          router.replace(next);
        }
      } catch {
        /* not logged in */
      }
    })();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notifications.show({ color: 'red', message: data.error || 'Login failed' });
        return;
      }
      const next = router.query.next || '/admin/users';
      router.replace(next);
    } catch {
      notifications.show({ color: 'red', message: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" radius="md" w="100%" maw={420}>
        <Title order={2} mb="lg">
          Admin login
        </Title>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} disabled={!email || !password} fullWidth>
              Sign in
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              NARIMATO administration
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
