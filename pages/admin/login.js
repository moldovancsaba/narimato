import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NarimatoFormField } from '../../components/NarimatoFormField';
import { NarimatoAuthShell } from '../../components/NarimatoAuthShell';

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
    <NarimatoAuthShell title="Admin login" subtitle="NARIMATO administration">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <NarimatoFormField label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </NarimatoFormField>
          <NarimatoFormField label="Password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </NarimatoFormField>
          <Button type="submit" loading={loading} disabled={!email || !password} fullWidth>
            Sign in
          </Button>
        </Stack>
      </form>
    </NarimatoAuthShell>
  );
}
