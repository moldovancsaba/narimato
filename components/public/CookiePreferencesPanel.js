import { useEffect, useState } from 'react';
import { Button, Paper, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusBadge } from '@gds/core';
import {
  CONSENT,
  applyConsent,
  getConsent,
  setConsent,
} from '../../lib/cookieConsent';

export function CookiePreferencesPanel({ showSavedMessage = true }) {
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    const current = getConsent();
    setSaved(current);
    setAnalytics(current === CONSENT.ACCEPTED);
    if (current) applyConsent(current);
  }, []);

  function save() {
    const value = analytics ? CONSENT.ACCEPTED : CONSENT.REJECTED;
    setConsent(value);
    applyConsent(value);
    setSaved(value);
    if (showSavedMessage) {
      notifications.show({
        color: 'green',
        message: analytics ? 'Analytics cookies enabled' : 'Analytics cookies disabled',
      });
    }
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>Essential cookies</Text>
            <Text size="sm" c="dimmed">
              Required to keep your survey session active after you enter a valid password. These cannot be turned
              off while using the service.
            </Text>
            <StatusBadge status="success" variant="light" w="fit-content">
              Always active
            </StatusBadge>
          </Stack>

          <Switch
            label="Analytics cookies"
            description="Google Analytics 4 with IP anonymisation. Helps us understand how the site is used."
            checked={analytics}
            onChange={(e) => setAnalytics(e.currentTarget.checked)}
          />

          <Button onClick={save} w={{ base: '100%', sm: 'auto' }}>
            Save preferences
          </Button>

          {saved ? (
            <Text size="xs" c="dimmed">
              Current setting: {saved === CONSENT.ACCEPTED ? 'Analytics accepted' : 'Essential only'}
            </Text>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
