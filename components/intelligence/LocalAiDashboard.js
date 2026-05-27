import { useEffect, useState } from 'react';
import {
  Anchor,
  Group,
  List,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { MetricCard, PageHeader, SemanticButton, StateBlock, StatusBadge } from '@doneisbetter/gds-core/client';
import { LocalAiQuickLinks } from './LocalAiQuickLinks';

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
      <PageHeader
        title="Local AI"
        description="Operator console and background workers on your Mac. Vercel only reads projections."
      />

      {!reachable && (
        <StateBlock
          variant="permission"
          title="Local intelligence offline"
          description={`Double-click Open Narimato Local AI on your Desktop, or run npm run intelligence:open. ${status?.error || ''}`}
          compact
        />
      )}

      {reachable && (
        <StateBlock
          variant={brainReady ? 'success' : 'not-enough-data'}
          title="Status server reachable"
          description={`Ollama ${status.ollama ? 'up' : 'down'} · model ${status.brain?.model || '—'}${status.brain?.modelReady ? '' : ' (model not ready)'}`}
          compact
        />
      )}

      <Group>
        <SemanticButton
          action="launch"
          component="a"
          href={operatorUrl}
          target="_blank"
          rel="noreferrer"
        />
        <SemanticButton action="refresh" variant="light" onClick={() => loadStatus()} />
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        <MetricCard
          label="Sync worker"
          value={status?.workers?.sync?.running ? 'Running' : 'Idle'}
          description={
            status?.links?.workers?.syncHealth?.url ? (
              <Anchor href={status.links.workers.syncHealth.url} size="xs" target="_blank" rel="noreferrer">
                Health :{ports.SYNC || 10005}
              </Anchor>
            ) : null
          }
        />
        <MetricCard
          label="Snapshot worker"
          value={status?.workers?.snapshotWorker?.lastRun ? 'Active' : 'Idle'}
          description={
            status?.links?.workers?.snapshotHealth?.url ? (
              <Anchor href={status.links.workers.snapshotHealth.url} size="xs" target="_blank" rel="noreferrer">
                Health :{ports.SNAPSHOT || 10007}
              </Anchor>
            ) : null
          }
        />
        <MetricCard
          label="Guardian"
          value={status?.workers?.guardian?.running ? 'Supervising' : 'Unknown'}
          description="npm run intelligence:install"
        />
        <MetricCard label="Dirty orgs" value={String(status?.dirty?.orgIds?.length ?? 0)} />
        <MetricCard
          label="Operator bundle"
          value={status?.operatorBundle ? 'Ready' : 'Pending'}
          description={
            <StatusBadge status={status?.operatorBundle ? 'success' : 'neutral'} variant="light">
              {status?.operatorBundle ? 'Ready' : 'Run build:operator'}
            </StatusBadge>
          }
        />
        <MetricCard
          label="Ollama"
          value={status?.ollama ? 'Reachable' : 'Offline'}
          description={
            status?.links?.ollama?.url ? (
              <Anchor href={status.links.ollama.url} size="xs" target="_blank" rel="noreferrer">
                API
              </Anchor>
            ) : null
          }
        />
      </SimpleGrid>

      <LocalAiQuickLinks links={status?.links} title="All related links" />

      <Paper p="md" withBorder>
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
