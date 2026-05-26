import { useCallback, useEffect, useState } from 'react';
import {
  Anchor,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { StatusBadge } from '@doneisbetter/gds-core/client';
import { NarimatoGdsAlert } from '../NarimatoGdsAlert';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { gdsAccentPanel } from '../../lib/ui/gdsSurfaces';

export function CorpusCardsConsole() {
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [sources, setSources] = useState([]);
  const [pendingCards, setPendingCards] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrgs = useCallback(async () => {
    const res = await fetch('/api/organizations');
    const data = await res.json();
    const list = data.organizations || [];
    setOrganizations(list);
    if (!orgId && list[0]) setOrgId(list[0].uuid);
  }, [orgId]);

  const loadOrgData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [srcRes, cardsRes] = await Promise.all([
        fetch(`/api/intelligence/sources?organizationId=${orgId}`),
        fetch(`/api/cards?organizationId=${orgId}`),
      ]);
      const srcData = await srcRes.json();
      const cardsData = await cardsRes.json();
      setSources(srcData.sources || []);
      setMeta(cardsData.meta || null);
      const pending = (cardsData.cards || []).filter((c) => c.approvalStatus === 'pending');
      setPendingCards(pending);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    loadOrgData();
  }, [loadOrgData]);

  async function addSource(e) {
    e.preventDefault();
    if (!orgId || !title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/intelligence/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          title: title.trim(),
          kind: 'markdown',
          content: content.trim(),
          enqueueIngest: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add source');
      setTitle('');
      setContent('');
      notifications.show({ color: 'green', message: 'Source queued for ingestion' });
      await loadOrgData();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function enqueueRefresh() {
    if (!orgId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/intelligence/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          type: 'REFRESH_PROJECTION',
          payload: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enqueue failed');
      notifications.show({
        color: 'teal',
        message: 'Projection refresh queued (runs on local Mac)',
      });
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const freshness = meta?.freshness?.status || 'unknown';
  const freshnessStatus =
    freshness === 'fresh' ? 'success' : freshness === 'stale' ? 'warning' : 'neutral';

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title="Corpus & cards"
        description="Ingest sources on the webapp; generation and HiTL approval run on the local operator console."
      />

      <NarimatoGdsAlert
        color="blue"
        title="Local operator required"
        description="Card mutations and Ollama generation run on the Mac operator console."
        action={
          <>
            <Anchor href="http://127.0.0.1:10006" target="_blank" rel="noreferrer">
              Open operator
            </Anchor>
            {' · '}
            <Anchor href="/local-ai">Local AI status</Anchor>
          </>
        }
      />

      <Select
        label="Organization"
        data={organizations.map((o) => ({ value: o.uuid, label: o.name }))}
        value={orgId}
        onChange={setOrgId}
        searchable
      />

      <Group>
        <StatusBadge status={freshnessStatus} variant="light">
          Projection: {freshness}
        </StatusBadge>
        <StatusBadge status="info" variant="outline">
          via {meta?.source || '—'}
        </StatusBadge>
        <NarimatoSemanticButton variant="secondary" size="sm" onClick={enqueueRefresh} loading={busy}>
          Refresh projection
        </NarimatoSemanticButton>
      </Group>

      <Paper p="md" withBorder style={gdsAccentPanel.default} component="form" onSubmit={addSource}>
        <Title order={4} mb="sm">
          Add corpus source
        </Title>
        <Stack gap="sm">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea
            label="Content (markdown)"
            minRows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <NarimatoSemanticButton type="submit" variant="primary" loading={busy}>
            Ingest source
          </NarimatoSemanticButton>
        </Stack>
      </Paper>

      {loading ? (
        <Loader />
      ) : (
        <>
          <Paper p="md" withBorder style={gdsAccentPanel.default}>
            <Title order={5} mb="xs">
              Sources ({sources.length})
            </Title>
            {sources.length === 0 ? (
              <Text c="dimmed" size="sm">
                No corpus sources yet.
              </Text>
            ) : (
              <Stack gap="xs">
                {sources.map((s) => (
                  <Group key={s.uuid} justify="space-between">
                    <Text size="sm">{s.title}</Text>
                    <StatusBadge
                      size="sm"
                      status={s.status === 'ingested' ? 'success' : s.status === 'failed' ? 'error' : 'neutral'}
                    >
                      {s.status}
                    </StatusBadge>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper p="md" withBorder style={gdsAccentPanel.default}>
            <Title order={5} mb="xs">
              Pending approval ({pendingCards.length})
            </Title>
            {pendingCards.length === 0 ? (
              <Text c="dimmed" size="sm">
                No pending generated cards. Approve in the operator console.
              </Text>
            ) : (
              <Stack gap="xs">
                {pendingCards.slice(0, 10).map((c) => (
                  <Text key={c.uuid} size="sm">
                    {c.title || c.name}
                  </Text>
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
