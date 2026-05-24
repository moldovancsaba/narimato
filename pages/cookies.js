import dynamic from 'next/dynamic';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { Stack, Text, Title } from '@mantine/core';

const CookiePreferencesPanel = dynamic(
  () => import('../components/public/CookiePreferencesPanel').then((m) => m.CookiePreferencesPanel),
  { ssr: false }
);

export default function CookiesPage() {
  return (
    <PublicShell>
      <Stack gap="lg">
        <NarimatoPageHeader
          title="Cookie preferences"
          subtitle="Manage how Narimato uses cookies on this device."
        />

        <CookiePreferencesPanel />

        <Stack gap="xs">
          <Title order={4}>What we use</Title>
          <Text size="sm" c="dimmed">
            Essential cookies store your survey access session (HTTP-only, 30 days) after you unlock a survey with
            your password. Analytics cookies, if enabled, are set by Google Analytics 4 under Consent Mode v2.
          </Text>
          <Text size="sm" c="dimmed">
            For full details see our{' '}
            <Text component="a" href="/privacy" span c="violet" inherit>
              privacy policy
            </Text>
            .
          </Text>
        </Stack>
      </Stack>
    </PublicShell>
  );
}
