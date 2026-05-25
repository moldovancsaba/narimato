import { useState } from 'react';
import { useRouter } from 'next/router';
import { Box, List, Paper, PasswordInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { GdsIcons } from '@gds/core';
import { NarimatoAccentPanel } from '../components/NarimatoAccentPanel';
import { NarimatoFormField } from '../components/NarimatoFormField';
import { NarimatoGdsAlert } from '../components/NarimatoGdsAlert';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { NarimatoSemanticButton } from '../components/NarimatoSemanticButton';
import { CONTACT_EMAIL } from '../components/public/PublicFooter';

export default function LandingPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const locked = router.isReady && router.query.locked === '1';

  async function unlockSurvey(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/survey/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.show({ color: 'red', message: data.error || 'Invalid survey password' });
        return;
      }
      notifications.show({ color: 'green', message: 'Welcome — opening your survey' });
      router.push(data.redirectUrl || '/play');
    } catch {
      notifications.show({ color: 'red', message: 'Could not verify password' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <Stack gap="xl">
        {locked ? (
          <NarimatoGdsAlert
            color="yellow"
            title="Survey password required"
            description="Enter the password your organisation shared with you to access this survey."
          />
        ) : null}

        <NarimatoPageHeader
          title="Deep surveys, fast and fun"
          subtitle="Narimato helps organisations understand what people really prefer — through swipe-and-rank play that feels like a game, not a form."
        />

        <NarimatoAccentPanel tone="violet">
          <Stack gap="md">
            <GroupIconRow
              icon={GdsIcons.Users}
              title="For organisations"
              text="Run structured preference surveys across decks of options — teams, products, ideas, or priorities."
            />
            <GroupIconRow
              icon={GdsIcons.Play}
              title="For participants"
              text="Answer in minutes with intuitive swipe and vote modes. No account required — just your personal access password."
            />
            <GroupIconRow
              icon={GdsIcons.Analytics}
              title="For insight"
              text="See ranked results and ELO-style scores that reveal true preferences, not just top-of-mind picks."
            />
          </Stack>
        </NarimatoAccentPanel>

        <Paper withBorder p="lg" radius="md" component="form" onSubmit={unlockSurvey}>
          <Stack gap="md">
            <Text fw={600} size="lg">
              Enter your survey password
            </Text>
            <Text size="sm" c="dimmed">
              Your organisation shared a password with you. Paste it below to open your personal survey.
            </Text>
            <NarimatoFormField label="Survey password">
              <PasswordInput
                placeholder="Paste password from your invite"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="md"
              />
            </NarimatoFormField>
            <NarimatoSemanticButton
              type="submit"
              action="start"
              loading={loading}
              disabled={!password.trim()}
              size="md"
              fullWidth
            />
          </Stack>
        </Paper>

        <Stack gap="xs">
          <Text fw={600}>How it works</Text>
          <List spacing="xs" size="sm" c="dimmed">
            <List.Item>Your organisation sets up a Narimato survey locally</List.Item>
            <List.Item>Participants receive a unique password</List.Item>
            <List.Item>Swipe or vote through cards — ranking happens automatically</List.Item>
            <List.Item>Results feed back to your organisation&apos;s dashboard</List.Item>
          </List>
        </Stack>

        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb={4}>
            Get in touch
          </Text>
          <Text size="sm" c="dimmed">
            Want Narimato for your organisation? Email{' '}
            <Text component="a" href={`mailto:${CONTACT_EMAIL}`} span inherit>
              {CONTACT_EMAIL}
            </Text>
          </Text>
        </Paper>
      </Stack>
    </PublicShell>
  );
}

function GroupIconRow({ icon: Icon, title, text }) {
  return (
    <Stack gap={4}>
      <Box
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--mantine-radius-md)',
          backgroundColor: 'light-dark(var(--mantine-color-violet-0), var(--mantine-color-dark-6))',
        }}
      >
        <Icon size="1.1rem" />
      </Box>
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed">
        {text}
      </Text>
    </Stack>
  );
}
