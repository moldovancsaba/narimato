import { useCallback, useEffect, useState } from 'react';
import {
  Anchor,
  Code,
  CopyButton,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EmptyState } from '@gds/core';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { LOCAL_TEST_URL, PUBLIC_SITE_URL } from './operatorCopy';
import { operatorApi } from '../../lib/operator/clientApi';

export function OperatorSurveyPanel({ orgId }) {
  const [status, setStatus] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const api = useCallback((path, opts) => operatorApi(path, opts), []);

  const load = useCallback(async () => {
    if (!orgId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const data = await api(`/api/survey-password?organizationId=${orgId}`);
    setStatus(data);
    setLoading(false);
  }, [api, orgId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function generatePassword(regenerate = false) {
    if (!orgId) return;
    setBusy(true);
    try {
      const data = await api('/api/survey-password', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, regenerate }),
      });
      if (data.password) {
        setGeneratedPassword(data.password);
        notifications.show({
          color: 'green',
          message: regenerate ? 'New password created' : 'Password created',
        });
      } else {
        notifications.show({
          color: 'yellow',
          message: 'A password already exists — use “Create new password” if you need a different one',
        });
      }
      await load();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function bootstrapSampleSurvey() {
    if (!orgId) return;
    setBusy(true);
    try {
      const data = await api('/api/survey-bootstrap', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (data.password) setGeneratedPassword(data.password);
      notifications.show({
        color: 'green',
        message: data.password ? 'Survey and password are ready' : 'Survey content updated',
      });
      await load();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (!orgId) {
    return (
      <EmptyState
        title="Choose an organisation"
        description="Use the selector above, or create one under Your organisation."
      />
    );
  }

  if (loading) return <Loader />;

  const needsSetup = !status?.deckReady || !status?.configured;
  const displayPassword = generatedPassword;

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title="Share survey"
        subtitle="Give participants a password so they can open the survey on the public website."
      />

      {needsSetup ? (
        <Paper withBorder p="md" radius="md" bg="violet.0">
          <Stack gap="sm">
            <Text fw={600}>Nothing to share yet</Text>
            <Text size="sm" c="dimmed">
              Set up demo survey cards and create a password in one step. You can replace the demo content later.
            </Text>
            <NarimatoSemanticButton action="start" loading={busy} onClick={bootstrapSampleSurvey} />
          </Stack>
        </Paper>
      ) : null}

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>How participants join</Text>
          <Stack gap="xs">
            <Text size="sm">1. They open the Narimato website</Text>
            <Text size="sm">2. They enter the password you send them</Text>
            <Text size="sm">3. They complete the survey cards</Text>
          </Stack>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={4}>
              <Text fw={600}>Participant password</Text>
              <Text size="sm" c="dimmed">
                {status?.configured
                  ? 'A password is active. Create a new one only if you need to replace the old one.'
                  : 'No password yet — create one below.'}
              </Text>
            </Stack>
            {status?.usageCount > 0 ? (
              <Text size="xs" c="dimmed">
                Used {status.usageCount} time{status.usageCount === 1 ? '' : 's'}
              </Text>
            ) : null}
          </Group>

          <Group gap="sm" wrap="wrap">
            {!status?.configured ? (
              <NarimatoSemanticButton action="add" loading={busy} onClick={() => generatePassword(false)} />
            ) : (
              <NarimatoSemanticButton
                action="duplicate"
                loading={busy}
                variant="light"
                onClick={() => generatePassword(true)}
              />
            )}
          </Group>

          {displayPassword ? (
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Copy and send this password
              </Text>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Code block style={{ flex: 1, wordBreak: 'break-all' }}>
                  {displayPassword}
                </Code>
                <CopyButton value={displayPassword}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'}>
                      <NarimatoSemanticButton
                        action="copy"
                        variant="light"
                        onClick={copy}
                        feedbackState={copied ? 'success' : undefined}
                      />
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <NarimatoSemanticButton
                action="play"
                variant="subtle"
                size="sm"
                component="a"
                href={LOCAL_TEST_URL}
                target="_blank"
                rel="noreferrer"
                w="fit-content"
              />
            </Stack>
          ) : status?.configured ? (
            <Text size="sm" c="dimmed">
              The password is stored securely and cannot be shown again. Create a new password if you lost the old one.
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md" bg="gray.0">
        <Stack gap="xs">
          <Text size="sm">
            <Text span fw={600}>
              Test site (on your computer):{' '}
            </Text>
            <Anchor href={LOCAL_TEST_URL} target="_blank" rel="noreferrer">
              {LOCAL_TEST_URL}
            </Anchor>
          </Text>
          <Text size="sm">
            <Text span fw={600}>
              Live site:{' '}
            </Text>
            {PUBLIC_SITE_URL}
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
