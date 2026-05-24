import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Anchor,
  Code,
  CopyButton,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NarimatoMetricCard } from '../NarimatoMetricCard';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { OperatorSetupSteps } from './OperatorSetupSteps';
import { LOCAL_TEST_URL } from './operatorCopy';
import { operatorApi } from '../../lib/operator/clientApi';

export function OperatorDashboard({ orgId, organizations, onSelectTab }) {
  const [status, setStatus] = useState(null);
  const [surveyReadiness, setSurveyReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const [bootstrapPassword, setBootstrapPassword] = useState('');

  const api = useCallback((path, opts) => operatorApi(path, opts), []);
  const orgCount = organizations?.length || 0;
  const hasOrg = orgCount > 0 && !!orgId;

  useEffect(() => {
    (async () => {
      try {
        const s = await api('/api/status');
        setStatus(s);
        if (orgId) {
          const survey = await api(`/api/survey-password?organizationId=${orgId}`);
          setSurveyReadiness(survey);
        } else {
          setSurveyReadiness(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [api, orgId]);

  async function bootstrapFirstSurvey() {
    if (!orgId) {
      onSelectTab('organizations');
      return;
    }
    setBootstrapBusy(true);
    try {
      const result = await api('/api/survey-bootstrap', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (result.password) setBootstrapPassword(result.password);
      setSurveyReadiness((prev) => ({
        ...prev,
        deckReady: result.deckReady,
        configured: result.surveyConfigured || result.passwordCreated || prev?.configured,
        playableDeckCount: result.playableDeckCount,
      }));
      notifications.show({
        color: 'green',
        title: 'Survey ready',
        message: result.password
          ? 'Copy the password below and share it with participants.'
          : 'Your sample survey is ready to test.',
      });
    } catch (err) {
      notifications.show({ color: 'red', message: err.message });
    } finally {
      setBootstrapBusy(false);
    }
  }

  if (loading) return <Loader />;

  const deckReady = surveyReadiness?.deckReady;
  const passwordReady = surveyReadiness?.configured;
  const allReady = hasOrg && deckReady && passwordReady;
  const currentStep = !hasOrg ? 0 : !deckReady || !passwordReady ? 1 : 2;
  const brainReady = status?.brain?.ready;
  const pendingCount = surveyReadiness?.pendingCount;

  const setupSteps = [
    {
      id: 'org',
      label: 'Name your organisation',
      detail: hasOrg
        ? `Working on ${organizations.find((o) => o.uuid === orgId)?.name || 'your organisation'}`
        : 'This is the team or company running the survey.',
      done: hasOrg,
      active: currentStep === 0,
      action: !hasOrg ? (
        <NarimatoSemanticButton action="add" size="xs" variant="light" onClick={() => onSelectTab('organizations')} />
      ) : null,
    },
    {
      id: 'setup',
      label: 'Create sample survey content',
      detail: deckReady
        ? `${surveyReadiness?.playableDeckCount || 1} deck ready for participants`
        : 'We add a small demo deck so you can try the flow immediately.',
      done: deckReady && passwordReady,
      active: currentStep === 1,
      action: hasOrg && (!deckReady || !passwordReady) ? (
        <NarimatoSemanticButton action="start" size="xs" loading={bootstrapBusy} onClick={bootstrapFirstSurvey} />
      ) : null,
    },
    {
      id: 'share',
      label: 'Share the password with participants',
      detail: passwordReady
        ? 'They enter it on the Narimato website to start the survey.'
        : 'A unique password is created when you set up the survey.',
      done: passwordReady,
      active: currentStep === 2,
      action: passwordReady ? (
        <NarimatoSemanticButton action="settings" size="xs" variant="light" onClick={() => onSelectTab('survey')} />
      ) : null,
    },
  ];

  return (
    <Stack gap="lg">
      <NarimatoPageHeader
        title={allReady ? 'Your survey is ready' : 'Set up your first survey'}
        subtitle={
          allReady
            ? 'Share the password, then open the public site to try it yourself.'
            : 'Follow the steps below — most people finish in under a minute.'
        }
      />

      {!hasOrg ? (
        <Alert color="violet" variant="light" title="Welcome to Narimato Setup">
          Start by creating an organisation — for example, your company name or project title. You can change details
          later.
        </Alert>
      ) : null}

      <OperatorSetupSteps steps={setupSteps} />

      {hasOrg ? (
        <Paper withBorder p="lg" radius="md" bg={allReady ? 'green.0' : 'violet.0'}>
          <Stack gap="md" align={allReady ? 'stretch' : 'flex-start'}>
            <Text fw={600}>{allReady ? 'Try it yourself' : 'Quick setup'}</Text>
            {!allReady ? (
              <Text size="sm" c="dimmed">
                One button creates demo survey cards and a participant password for{' '}
                <Text span fw={600}>
                  {organizations.find((o) => o.uuid === orgId)?.name}
                </Text>
                .
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Open the public site, paste your password, and walk through the survey as a participant would.
              </Text>
            )}
            <Group gap="sm" wrap="wrap">
              {!allReady ? (
                <NarimatoSemanticButton size="md" action="start" loading={bootstrapBusy} onClick={bootstrapFirstSurvey} />
              ) : (
                <>
                  <NarimatoSemanticButton
                    size="md"
                    action="play"
                    component="a"
                    href={LOCAL_TEST_URL}
                    target="_blank"
                    rel="noreferrer"
                  />
                  <NarimatoSemanticButton
                    size="md"
                    action="settings"
                    variant="light"
                    onClick={() => onSelectTab('survey')}
                  />
                </>
              )}
            </Group>
          </Stack>
        </Paper>
      ) : (
        <NarimatoSemanticButton size="md" action="add" onClick={() => onSelectTab('organizations')} />
      )}

      {bootstrapPassword || (passwordReady && allReady) ? (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Participant password</Text>
            <Text size="sm" c="dimmed">
              Send this to people taking the survey. It is only shown here after generation.
            </Text>
            {bootstrapPassword ? (
              <Group gap="xs" wrap="nowrap">
                <Code block style={{ flex: 1 }}>
                  {bootstrapPassword}
                </Code>
                <CopyButton value={bootstrapPassword}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy password'}>
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
            ) : (
              <Text size="sm">
                Password already set.{' '}
                <Anchor size="sm" onClick={() => onSelectTab('survey')}>
                  View or regenerate in Share survey
                </Anchor>
              </Text>
            )}
          </Stack>
        </Paper>
      ) : null}

      {hasOrg ? (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          <NarimatoMetricCard label="Organisations" value={String(orgCount)} hint="In this setup workspace" />
          <NarimatoMetricCard
            label="Playable decks"
            value={deckReady ? String(surveyReadiness?.playableDeckCount ?? 1) : '—'}
            hint={deckReady ? 'Ready for participants' : 'Run setup to create demo deck'}
          />
          <NarimatoMetricCard
            label="AI assistant"
            value={brainReady ? 'Connected' : 'Offline'}
            status={brainReady ? 'success' : 'danger'}
            hint="Local brain / Ollama"
          />
          <NarimatoMetricCard
            label="Pending AI cards"
            value={pendingCount != null ? String(pendingCount) : '—'}
            hint="Awaiting approval in AI tools"
          />
        </SimpleGrid>
      ) : null}

      <Accordion variant="contained" radius="md">
        <Accordion.Item value="system">
          <Accordion.Control>System details (optional)</Accordion.Control>
          <Accordion.Panel>
            <Text size="xs" c="dimmed">
              Metrics above cover routine checks. Expand only when troubleshooting connections or projection sync.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
