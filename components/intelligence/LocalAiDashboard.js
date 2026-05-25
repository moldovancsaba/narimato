import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Code,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { StatusBadge } from '@gds/core';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { gdsAccentSurface } from '../../lib/ui/gdsSurfaces';

const OPERATOR_URL = 'http://127.0.0.1:10006';

export function LocalAiDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/intelligence/status');
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setStatus({ reachable: false, error: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(() => {
      fetch('/api/intelligence/status')
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {});
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text c="dimmed">Checking local intelligence…</Text>
      </Stack>
    );
  }

  const reachable = status?.reachable === true;
  const brainReady = status?.brain?.ready === true;

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title="Local AI"
        description="Operator console and background workers run on your Mac (not Vercel)."
      />

      {!reachable && (
        <Alert color="orange" title="Local intelligence offline">
          Start workers with{' '}
          <Code>npm run intelligence:guardian</Code> then open{' '}
          <Anchor href={OPERATOR_URL} target="_blank" rel="noreferrer">
            {OPERATOR_URL}
          </Anchor>
          . {status?.error ? `(${status.error})` : null}
        </Alert>
      )}

      {reachable && (
        <Alert color={brainReady ? 'green' : 'yellow'} title="Status server reachable">
          Ollama {status.ollama ? 'up' : 'down'} · model {status.brain?.model || '—'}
          {status.brain?.modelReady ? '' : ' (model not ready)'}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Sync worker
          </Text>
          <Title order={4}>{status?.workers?.sync?.running ? 'Running' : 'Idle'}</Title>
          <Text size="xs" c="dimmed">
            Port {status?.ports?.SYNC || 10005}
          </Text>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Snapshot worker
          </Text>
          <Title order={4}>
            {status?.workers?.snapshotWorker?.lastRun ? 'Active' : 'Idle'}
          </Title>
          <Text size="xs" c="dimmed">
            Port {status?.ports?.SNAPSHOT || 10007}
          </Text>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Dirty orgs
          </Text>
          <Title order={4}>{status?.dirty?.orgIds?.length ?? 0}</Title>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Operator UI
          </Text>
          <Group mt="xs">
            <StatusBadge status={status?.operatorBundle ? 'success' : 'neutral'} variant="light">
              {status?.operatorBundle ? 'Bundle ready' : 'No bundle'}
            </StatusBadge>
          </Group>
        </Paper>
      </SimpleGrid>

      <Group>
        <NarimatoSemanticButton
          component="a"
          href={OPERATOR_URL}
          target="_blank"
          rel="noreferrer"
          variant="primary"
        >
          Open operator console
        </NarimatoSemanticButton>
        <NarimatoSemanticButton variant="secondary" onClick={() => window.location.reload()}>
          Refresh status
        </NarimatoSemanticButton>
      </Group>
    </Stack>
  );
}
