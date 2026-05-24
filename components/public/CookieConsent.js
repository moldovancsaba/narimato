import { useEffect, useState } from 'react';
import { Paper, Stack, Text, Button, Group, Anchor } from '@mantine/core';
import Link from 'next/link';
import {
  CONSENT,
  applyConsent,
  getConsent,
  setConsent,
  syncConsentFromStorage,
} from '../../lib/cookieConsent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = getConsent();
    if (!saved) setVisible(true);
    else syncConsentFromStorage();
  }, []);

  const accept = () => {
    setConsent(CONSENT.ACCEPTED);
    applyConsent(CONSENT.ACCEPTED);
    setVisible(false);
  };

  const reject = () => {
    setConsent(CONSENT.REJECTED);
    applyConsent(CONSENT.REJECTED);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Paper
      shadow="lg"
      radius="md"
      p="md"
      withBorder
      pos="fixed"
      bottom={{ base: 12, sm: 16 }}
      left={{ base: 12, sm: 16 }}
      right={{ base: 12, sm: 16 }}
      maw={520}
      mx="auto"
      style={{ zIndex: 1000 }}
    >
      <Stack gap="sm">
        <Text fw={600} size="sm">
          Cookies & analytics
        </Text>
        <Text size="sm" c="dimmed">
          We use essential cookies to run Narimato and optional analytics to improve the experience. See our{' '}
          <Anchor component={Link} href="/privacy" size="sm">
            privacy policy
          </Anchor>{' '}
          or{' '}
          <Anchor component={Link} href="/cookies" size="sm">
            manage preferences
          </Anchor>
          .
        </Text>
        <Group gap="sm" wrap="wrap">
          <Button size="sm" onClick={accept}>
            Accept analytics
          </Button>
          <Button size="sm" variant="default" onClick={reject}>
            Essential only
          </Button>
          <Button size="sm" variant="subtle" component={Link} href="/cookies">
            Manage
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
