import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Button,
  Code,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ConfirmDialog, EmptyState, StatusBadge } from '@gds/core';
import { NarimatoFormField } from '../NarimatoFormField';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { operatorApi } from '../../lib/operator/clientApi';

const REGEN_MODES = [
  { value: 'GENERATE_DECK_CARDS', label: 'Generate (new deck content)' },
  { value: 'REPLACE_DECK', label: 'Replace entire deck' },
  { value: 'REPLACE_BRANCH', label: 'Replace branch' },
  { value: 'APPEND_CARDS', label: 'Append cards only' },
  { value: 'REGENERATE_TAG', label: 'Regenerate single tag' },
];

function brainStatus(status) {
  return status?.brain?.ready ? 'success' : 'danger';
}

export function LocalOperatorConsole({ apiBase, embedded = false, orgId: orgIdProp, hideOrgManagement = false, simplified = false }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [orgIdInternal, setOrgIdInternal] = useState('');
  const orgId = orgIdProp || orgIdInternal;
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [currentTopicId, setCurrentTopicId] = useState(null);
  const [chatLog, setChatLog] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [deckRoot, setDeckRoot] = useState('#SampleDeck');
  const [cardCount, setCardCount] = useState('6');
  const [hierarchyLevels, setHierarchyLevels] = useState('2');
  const [approvedSummary, setApprovedSummary] = useState('');
  const [targetBranchTag, setTargetBranchTag] = useState('');
  const [regenerateTag, setRegenerateTag] = useState('');
  const [regenMode, setRegenMode] = useState('GENERATE_DECK_CARDS');
  const [useFixture, setUseFixture] = useState('0');
  const [autoDeck, setAutoDeck] = useState('#SampleDeck');
  const [autoApprove, setAutoApprove] = useState('0');
  const [cardTitle, setCardTitle] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardParent, setCardParent] = useState('');
  const [pendingCards, setPendingCards] = useState([]);
  const [jobsLog, setJobsLog] = useState('—');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const api = useCallback((path, opts) => operatorApi(path, opts, apiBase), [apiBase]);

  const loadStatus = useCallback(async () => {
    const s = await api('/api/status');
    setStatus(s);
  }, [api]);

  const loadOrgs = useCallback(async () => {
    const { organizations: orgs } = await api('/api/organizations');
    setOrganizations(orgs || []);
    if (orgs?.length && !orgIdProp && !orgIdInternal) setOrgIdInternal(orgs[0].uuid);
  }, [api, orgIdProp, orgIdInternal]);

  const loadPending = useCallback(async () => {
    if (!orgId) return;
    const { cards } = await api(`/api/cards/pending?organizationId=${orgId}`);
    setPendingCards(cards || []);
  }, [api, orgId]);

  const loadJobs = useCallback(async () => {
    if (!orgId) return;
    const { jobs } = await api(`/api/jobs?organizationId=${orgId}`);
    setJobsLog(JSON.stringify(jobs, null, 2));
  }, [api, orgId]);

  useEffect(() => {
    (async () => {
      try {
        if (!hideOrgManagement) await loadOrgs();
        await loadStatus();
      } catch (err) {
        notifications.show({ color: 'red', message: err.message || 'Failed to connect to operator API' });
      } finally {
        setLoading(false);
      }
    })();
  }, [hideOrgManagement, loadOrgs, loadStatus]);

  useEffect(() => {
    if (!orgId) return;
    loadPending();
    loadJobs();
  }, [orgId, loadPending, loadJobs]);

  useEffect(() => {
    const id = setInterval(loadStatus, 10000);
    return () => clearInterval(id);
  }, [loadStatus]);

  const appendChat = (role, text) => {
    setChatLog((prev) => `${prev}\n[${role}] ${text}\n`);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      const r = await api('/api/cards/reject', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, cardUuids: [rejectTarget.uuid] }),
      });
      if (r.skipped && !r.rejected) {
        notifications.show({ color: 'yellow', message: 'Nothing rejected — card is not pending.' });
      } else {
        notifications.show({ color: 'green', message: 'Card rejected' });
      }
      setRejectTarget(null);
      await loadPending();
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setRejectLoading(false);
    }
  };

  if (loading) {
    return embedded ? <Loader /> : <Loader m="xl" />;
  }

  const content = (
    <Stack gap="lg" maw={embedded ? undefined : 1100}>
      {!hideOrgManagement ? (
        <NarimatoPageHeader
          title="Narimato local operator"
          subtitle="All management runs here (127.0.0.1). Vercel webapp is play/read-only."
        />
      ) : (
        <NarimatoPageHeader
          title="AI assistant"
          subtitle={
            simplified
              ? 'Optional — generate survey cards automatically. Most people can skip this and use Home → Set up test survey.'
              : 'Topic clarification, generation jobs, and human-in-the-loop approval.'
          }
        />
      )}

      {simplified ? (
        <Alert color="blue" variant="light" title="Advanced feature">
          This area is for AI-generated content. If you only want to try Narimato, use the Home tab instead.
        </Alert>
      ) : null}

      {simplified ? (
        <Accordion variant="contained" radius="md" defaultValue={null}>
          <Accordion.Item value="runtime">
            <Accordion.Control>Connection status</Accordion.Control>
            <Accordion.Panel>
              {status ? (
                <Group gap="xs">
                  <StatusBadge status={brainStatus(status)} variant="light">
                    {status.brain?.ready ? `AI connected (${status.brain.model})` : 'AI offline — start Ollama on this computer'}
                  </StatusBadge>
                </Group>
              ) : (
                <Text c="dimmed" size="sm">
                  Status unavailable
                </Text>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : (
      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          Runtime status
        </Text>
        {status ? (
          <Group gap="xs">
            <StatusBadge status={brainStatus(status)} variant="light">
              {status.brain?.ready ? `Brain ready (${status.brain.model})` : 'Brain offline — check Ollama'}
            </StatusBadge>
            <StatusBadge status="neutral" variant="outline">
              sync {status.ports?.SYNC} · snapshot {status.ports?.SNAPSHOT}
            </StatusBadge>
            <StatusBadge status="info" variant="light">
              dirty orgs: {(status.dirty?.orgIds || []).length}
            </StatusBadge>
          </Group>
        ) : (
          <Text c="dimmed" size="sm">
            Status unavailable
          </Text>
        )}
      </Paper>
      )}

      {!hideOrgManagement ? (
        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="sm">
            Organization
          </Text>
          <Stack gap="sm">
            <NarimatoFormField label="Active org">
              <Select
                data={organizations.map((o) => ({ value: o.uuid, label: `${o.name} (${o.slug})` }))}
                value={orgId || null}
                onChange={setOrgIdInternal}
              />
            </NarimatoFormField>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NarimatoFormField label="New org name">
                <TextInput value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </NarimatoFormField>
              <NarimatoFormField label="Slug">
                <TextInput value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
              </NarimatoFormField>
            </SimpleGrid>
            <NarimatoSemanticButton
              action="add"
              onClick={async () => {
                try {
                  await api('/api/organizations', {
                    method: 'POST',
                    body: JSON.stringify({ name: orgName, slug: orgSlug }),
                  });
                  notifications.show({ color: 'green', message: 'Organization created' });
                  await loadOrgs();
                } catch (err) {
                  notifications.show({ color: 'red', message: err.message });
                }
              }}
            />
          </Stack>
        </Paper>
      ) : null}

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {simplified ? 'Describe your topic' : 'Topic clarification (local agent)'}
        </Text>
        <Stack gap="sm">
          <NarimatoFormField label="Topic title">
            <TextInput
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g. European football legends"
            />
          </NarimatoFormField>
          <NarimatoSemanticButton
            action="start"
            onClick={async () => {
              try {
                const { topic } = await api('/api/topics', {
                  method: 'POST',
                  body: JSON.stringify({ organizationId: orgId, title: topicTitle }),
                });
                setCurrentTopicId(topic.uuid);
                appendChat('system', `Topic session ${topic.uuid}`);
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
          <NarimatoFormField label="Chat log">
            <Textarea value={chatLog} readOnly minRows={4} />
          </NarimatoFormField>
          <NarimatoFormField label="Your message">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Clarify the deck topic…"
            />
          </NarimatoFormField>
          <NarimatoSemanticButton
            action="send"
            onClick={async () => {
              if (!currentTopicId) {
                notifications.show({ color: 'yellow', message: 'Create a topic session first' });
                return;
              }
              try {
                appendChat('you', chatInput);
                const { reply } = await api('/api/topics/chat', {
                  method: 'POST',
                  body: JSON.stringify({ topicSpecId: currentTopicId, message: chatInput }),
                });
                appendChat('agent', reply);
                setChatInput('');
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NarimatoFormField label="Deck root hashtag">
              <TextInput value={deckRoot} onChange={(e) => setDeckRoot(e.target.value)} />
            </NarimatoFormField>
            <NarimatoFormField label="Card count">
              <TextInput type="number" value={cardCount} onChange={(e) => setCardCount(e.target.value)} />
            </NarimatoFormField>
          </SimpleGrid>
          <NarimatoFormField label="Hierarchy levels">
            <TextInput
              type="number"
              value={hierarchyLevels}
              onChange={(e) => setHierarchyLevels(e.target.value)}
            />
          </NarimatoFormField>
          <NarimatoFormField label="Approved summary">
            <Textarea value={approvedSummary} onChange={(e) => setApprovedSummary(e.target.value)} />
          </NarimatoFormField>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NarimatoFormField label="Branch tag (REPLACE_BRANCH)">
              <TextInput
                value={targetBranchTag}
                onChange={(e) => setTargetBranchTag(e.target.value)}
                placeholder="#Soccer"
              />
            </NarimatoFormField>
            <NarimatoFormField label="Regenerate tag (REGENERATE_TAG)">
              <TextInput
                value={regenerateTag}
                onChange={(e) => setRegenerateTag(e.target.value)}
                placeholder="#Player-Name"
              />
            </NarimatoFormField>
          </SimpleGrid>
          <NarimatoSemanticButton
            action="confirm"
            onClick={async () => {
              if (!currentTopicId) {
                notifications.show({ color: 'yellow', message: 'Create a topic session first' });
                return;
              }
              try {
                await api('/api/topics/approve', {
                  method: 'POST',
                  body: JSON.stringify({
                    topicSpecId: currentTopicId,
                    deckRootTag: deckRoot,
                    approvedSummary,
                    cardCount: Number(cardCount),
                    hierarchyLevels: Number(hierarchyLevels),
                    targetBranchTag: targetBranchTag || null,
                    regenerateTag: regenerateTag || null,
                  }),
                });
                notifications.show({ color: 'green', message: 'Topic approved' });
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          Generation
        </Text>
        <Stack gap="sm">
          <NarimatoFormField label="Regeneration mode">
            <Select data={REGEN_MODES} value={regenMode} onChange={setRegenMode} />
          </NarimatoFormField>
          <NarimatoFormField label="Use fixture (skip Ollama)">
            <Select
              data={[
                { value: '0', label: 'No — call Ollama (brain)' },
                { value: '1', label: 'Yes — smoke fixture only' },
              ]}
              value={useFixture}
              onChange={setUseFixture}
            />
          </NarimatoFormField>
          <Group>
            <NarimatoSemanticButton
              action="start"
              onClick={async () => {
                if (!currentTopicId) {
                  notifications.show({ color: 'yellow', message: 'Approve a topic first' });
                  return;
                }
                try {
                  await api('/api/jobs', {
                    method: 'POST',
                    body: JSON.stringify({
                      organizationId: orgId,
                      type: regenMode,
                      payload: { topicSpecId: currentTopicId, useFixture: useFixture === '1' },
                    }),
                  });
                  await loadJobs();
                  notifications.show({ color: 'green', message: 'Job enqueued' });
                } catch (err) {
                  notifications.show({ color: 'red', message: err.message });
                }
              }}
            />
            <Button
              variant="default"
              onClick={async () => {
                try {
                  await api('/api/projection/refresh', {
                    method: 'POST',
                    body: JSON.stringify({ organizationId: orgId }),
                  });
                  notifications.show({ color: 'green', message: 'Projection refreshed' });
                } catch (err) {
                  notifications.show({ color: 'red', message: err.message });
                }
              }}
            >
              Refresh projection now
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          {simplified ? 'Review AI suggestions' : 'HiTL — pending cards'}
        </Text>
        {pendingCards.length === 0 ? (
          <EmptyState title="No pending cards" description="Generated cards awaiting approval appear here." />
        ) : (
          <Stack gap="sm">
            {pendingCards.map((card) => (
              <Paper key={card.uuid} withBorder p="sm" radius="sm">
                <Text fw={600}>{card.name}</Text>
                <Text size="sm" c="dimmed">
                  {card.title}
                </Text>
                <Group mt="xs">
                  <NarimatoSemanticButton
                    action="check"
                    size="xs"
                    onClick={async () => {
                      try {
                        const r = await api('/api/cards/approve', {
                          method: 'POST',
                          body: JSON.stringify({ organizationId: orgId, cardUuids: [card.uuid] }),
                        });
                        if (r.skipped) {
                          notifications.show({ color: 'yellow', message: `${r.skipped} skipped — not pending` });
                        }
                        await loadPending();
                      } catch (err) {
                        notifications.show({ color: 'red', message: err.message });
                      }
                    }}
                  />
                  <NarimatoSemanticButton
                    action="delete"
                    size="xs"
                    variant="default"
                    color="red"
                    onClick={() => setRejectTarget(card)}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    onClick={async () => {
                      await api('/api/cards/feedback', {
                        method: 'POST',
                        body: JSON.stringify({ organizationId: orgId, cardUuid: card.uuid, feedback: 'up' }),
                      });
                    }}
                  >
                    👍
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={async () => {
                      await api('/api/cards/feedback', {
                        method: 'POST',
                        body: JSON.stringify({ organizationId: orgId, cardUuid: card.uuid, feedback: 'down' }),
                      });
                    }}
                  >
                    👎
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        <Group mt="md">
          <NarimatoSemanticButton
            action="complete"
            onClick={async () => {
              try {
                await api('/api/cards/approve', {
                  method: 'POST',
                  body: JSON.stringify({
                    organizationId: orgId,
                    cardUuids: pendingCards.map((c) => c.uuid),
                  }),
                });
                await loadPending();
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
          <Button variant="default" onClick={loadPending}>
            Reload
          </Button>
          <Button
            variant="default"
            onClick={async () => {
              try {
                await api('/api/feedback/reconcile', {
                  method: 'POST',
                  body: JSON.stringify({ organizationId: orgId, archiveDownvoted: false }),
                });
                await loadJobs();
                notifications.show({ color: 'green', message: 'Reconcile job enqueued' });
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          >
            Reconcile thumbs-down
          </Button>
        </Group>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          Per-deck auto-approval
        </Text>
        <Stack gap="sm">
          <NarimatoFormField label="Deck root hashtag">
            <TextInput value={autoDeck} onChange={(e) => setAutoDeck(e.target.value)} />
          </NarimatoFormField>
          <NarimatoFormField label="Auto-approve generated cards">
            <Select
              data={[
                { value: '0', label: 'Off (HiTL)' },
                { value: '1', label: 'On' },
              ]}
              value={autoApprove}
              onChange={setAutoApprove}
            />
          </NarimatoFormField>
          <NarimatoSemanticButton
            action="save"
            onClick={async () => {
              try {
                await api('/api/deck-config', {
                  method: 'POST',
                  body: JSON.stringify({
                    organizationId: orgId,
                    deckRootTag: autoDeck,
                    autoApprove: autoApprove === '1',
                  }),
                });
                notifications.show({ color: 'green', message: 'Deck setting saved' });
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          Manual card (hybrid override)
        </Text>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NarimatoFormField label="Title">
              <TextInput value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
            </NarimatoFormField>
            <NarimatoFormField label="Name (#tag)">
              <TextInput
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="#MyCard"
              />
            </NarimatoFormField>
          </SimpleGrid>
          <NarimatoFormField label="Parent deck tag">
            <TextInput
              value={cardParent}
              onChange={(e) => setCardParent(e.target.value)}
              placeholder="#SampleDeck"
            />
          </NarimatoFormField>
          <NarimatoSemanticButton
            action="add"
            onClick={async () => {
              try {
                await api('/api/cards', {
                  method: 'POST',
                  body: JSON.stringify({
                    organizationId: orgId,
                    title: cardTitle,
                    name: cardName,
                    parentTag: cardParent || null,
                  }),
                });
                notifications.show({ color: 'green', message: 'Card created' });
              } catch (err) {
                notifications.show({ color: 'red', message: err.message });
              }
            }}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">
          Recent jobs
        </Text>
        <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
          {jobsLog}
        </Code>
      </Paper>

      <ConfirmDialog
        opened={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={confirmReject}
        title="Reject card"
        confirmAction="delete"
        isDanger
        loading={rejectLoading}
      >
        <Text size="sm">Reject &quot;{rejectTarget?.title}&quot;? This archives pending output.</Text>
      </ConfirmDialog>
    </Stack>
  );

  if (embedded) return content;
  return (
    <Stack p="md" pb="xl">
      {content}
    </Stack>
  );
}
