import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Code,
  Group,
  List,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { StatusBadge } from '@gds/core';
import { LocalAiQuickLinks } from './LocalAiQuickLinks';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { gdsAccentSurface } from '../../lib/ui/gdsSurfaces';

export function LocalAiDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = () =>
    fetch('/api/intelligence/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch((err) => setStatus({ reachable: false, error: err.message }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetch('/api/intelligence/status').then((r) => r.json());
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setStatus({ reachable: false, error: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(() => {
      if (!cancelled) loadStatus();
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
  const operatorUrl = status?.links?.operator?.url || status?.operatorUrl || 'http://127.0.0.1:10006/';
  const ports = status?.ports || { SYNC: 10005, STATUS: 10006, SNAPSHOT: 10007 };

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title="Local AI"
        description="Operator console and background workers on your Mac. Vercel only reads projections."
      />

      {!reachable && (
        <Alert color="orange" title="Local intelligence offline">
          Double-click <strong>Open Narimato Local AI</strong> on your Desktop, or run{' '}
          <Code>npm run intelligence:open</Code>. Install auto-start:{' '}
          <Code>npm run intelligence:install</Code>
          {status?.error ? (
            <Text size="sm" mt="xs">
              ({status.error})
            </Text>
          ) : null}
        </Alert>
      )}

      {reachable && (
        <Alert color={brainReady ? 'green' : 'yellow'} title="Status server reachable">
          Ollama {status.ollama ? 'up' : 'down'} · model {status.brain?.model || '—'}
          {status.brain?.modelReady ? '' : ' (model not ready)'}
        </Alert>
      )}

      <Group>
        <NarimatoSemanticButton
          component="a"
          href={operatorUrl}
          target="_blank"
          rel="noreferrer"
          variant="primary"
        >
          Open operator console
        </NarimatoSemanticButton>
        <NarimatoSemanticButton variant="secondary" onClick={() => loadStatus()}>
          Refresh status
        </NarimatoSemanticButton>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Sync worker
          </Text>
          <Title order={4}>{status?.workers?.sync?.running ? 'Running' : 'Idle'}</Title>
          <Anchor href={status?.links?.workers?.syncHealth?.url} size="xs" target="_blank" rel="noreferrer">
            Health :{ports.SYNC || 10005}
          </Anchor>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Snapshot worker
          </Text>
          <Title order={4}>
            {status?.workers?.snapshotWorker?.lastRun ? 'Active' : 'Idle'}
          </Title>
          <Anchor
            href={status?.links?.workers?.snapshotHealth?.url}
            size="xs"
            target="_blank"
            rel="noreferrer"
          >
            Health :{ports.SNAPSHOT || 10007}
          </Anchor>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Guardian
          </Text>
          <Title order={4}>
            {status?.workers?.guardian?.running ? 'Supervising' : 'Unknown'}
          </Title>
          <Text size="xs" c="dimmed">
            npm run intelligence:install
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
            Operator bundle
          </Text>
          <Group mt="xs">
            <StatusBadge status={status?.operatorBundle ? 'success' : 'neutral'} variant="light">
              {status?.operatorBundle ? 'Ready' : 'Run build:operator'}
            </StatusBadge>
          </Group>
        </Paper>
        <Paper p="md" withBorder style={gdsAccentSurface}>
          <Text size="sm" c="dimmed">
            Ollama
          </Text>
          <Title order={4}>{status?.ollama ? 'Reachable' : 'Offline'}</Title>
          {status?.links?.ollama?.url ? (
            <Anchor href={status.links.ollama.url} size="xs" target="_blank" rel="noreferrer">
              API
            </Anchor>
          ) : null}
        </Paper>
      </SimpleGrid>

      <LocalAiQuickLinks links={status?.links} title="All related links" />

      <Paper p="md" withBorder style={gdsAccentSurface}>
        <Title order={5} mb="sm">
          Operator menu (port {ports.STATUS || 10006})
        </Title>
        <List size="sm" spacing="xs">
          <List.Item>Home — survey setup & bootstrap</List.Item>
          <List.Item>Your organisation — org name & slug</List.Item>
          <List.Item>Share survey — participant password</List.Item>
          <List.Item>Survey cards — manual CRUD & pending approval</List.Item>
          <List.Item>AI assistant — topic chat, generate, regen jobs</List.Item>
          <List.Item>Related pages — links to webapp /local-ai, /cards, /play</List.Item>
        </List>
      </Paper>
    </Stack>
  );
}
