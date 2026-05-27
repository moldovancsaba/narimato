import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { AuthShell, FormField, SemanticButton } from '@doneisbetter/gds-core/client';
import { NarimatoThemeToggle } from '../../components/NarimatoThemeToggle';
import { showErrorNotification } from '../../lib/ui/notifications';

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
        showErrorNotification(data.error || 'Login failed');
        return;
      }
      const next = router.query.next || '/admin/users';
      router.replace(next);
    } catch {
      showErrorNotification('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Admin login"
      description="NARIMATO administration"
      brand={<Text fw={800}>NARIMATO</Text>}
      headerActions={<NarimatoThemeToggle size="md" />}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <FormField label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormField>
          <SemanticButton
            type="submit"
            action="login"
            loading={loading}
            disabled={!email || !password}
            fullWidth
          />
        </Stack>
      </form>
    </AuthShell>
  );
}
