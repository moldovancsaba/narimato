import Link from 'next/link';
import {
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Title,
} from '@mantine/core';
import { ChoiceChip, EmptyState, PageHeader, PublicShell, SemanticButton, StatusBadge } from '@doneisbetter/gds-core/client';
import { event } from '../../lib/analytics/ga';
import { getPublicShellProps } from '../../lib/ui/publicChrome';

const MODES = [
  { key: 'swipe-only', label: 'Swipe only' },
  { key: 'vote-only', label: 'Vote only' },
  { key: 'swipe-more', label: 'Swipe more' },
  { key: 'vote-more', label: 'Vote more' },
  { key: 'rank-only', label: 'Rank only' },
  { key: 'rank-more', label: 'Rank more' },
];

function projectionStatus(freshness) {
  if (freshness === 'fresh') return 'success';
  if (freshness === 'missing') return 'warning';
  return 'neutral';
}

export function PlayOrgPicker({ organizations, loading }) {
  if (loading) {
    return (
      <PublicShell {...getPublicShellProps('home')}>
        <Loader />
      </PublicShell>
    );
  }

  return (
    <PublicShell {...getPublicShellProps('home')}>
      <Stack gap="lg">
        <PageHeader title="Select survey" subtitle="Choose your organisation's survey to continue." />
        {organizations.length === 0 ? (
          <EmptyState
            title="No surveys available"
            description="Enter your survey password on the home page, or contact your organiser."
            action={
              <SemanticButton action="back" component={Link} href="/" />
            }
          />
        ) : (
          <Stack gap="md">
            {organizations.map((organization) => (
              <Paper key={organization.uuid} withBorder p="md" radius="md">
                <Title order={4}>{organization.name}</Title>
                <SemanticButton
                  action="play"
                  component={Link}
                  href={`/play?org=${organization.uuid}`}
                  mt="sm"
                />
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </PublicShell>
  );
}

export function PlayDeckPicker({ org, decks, projectionMeta }) {
  const freshness = projectionMeta?.freshness?.status || 'unknown';

  return (
    <PublicShell {...getPublicShellProps('home')}>
      <Stack gap="lg">
        <PageHeader title="Select deck" subtitle="Pick a deck to start ranking." />
        {projectionMeta ? (
          <Group gap="xs">
            <StatusBadge status={projectionStatus(freshness)} variant="light">
              Projection: {freshness}
            </StatusBadge>
            {projectionMeta.source ? (
              <Badge variant="outline">via {projectionMeta.source}</Badge>
            ) : null}
          </Group>
        ) : null}
        {decks.length === 0 ? (
          <EmptyState
            title="No decks yet"
            description="Your organiser has not published any playable decks. Check back later."
            action={
              <SemanticButton action="back" component={Link} href="/" />
            }
          />
        ) : (
          <Stack gap="md">
            {decks.map((deckInfo) => (
              <Paper key={deckInfo.tag} withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Title order={4}>{deckInfo.tag}</Title>
                  <StatusBadge status="success" variant="light">
                    {deckInfo.cards.length} cards
                  </StatusBadge>
                </Group>
                <Group gap="xs" mb="md">
                  {deckInfo.cards.slice(0, 3).map((card) => (
                    <Badge key={card.uuid} variant="default">
                      {card.title}
                    </Badge>
                  ))}
                  {deckInfo.cards.length > 3 ? (
                    <Badge variant="outline">+{deckInfo.cards.length - 3} more</Badge>
                  ) : null}
                </Group>
                <Group gap="xs">
                  {MODES.map((mode) => (
                    <ChoiceChip
                      key={mode.key}
                      label={mode.label}
                      href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=${mode.key}`}
                      onClick={() => {
                        try {
                          event('mode_selected', { org, deckTag: deckInfo.tag, mode: mode.key });
                        } catch {
                          /* noop */
                        }
                      }}
                    />
                  ))}
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </PublicShell>
  );
}

export function PlayComplete({ org, deck }) {
  return (
    <PublicShell {...getPublicShellProps('home')}>
      <Stack align="center" gap="lg" py="xl">
        <PageHeader
          title="Survey complete"
          subtitle={`You finished ranking all cards in ${deck}.`}
        />
        <Group>
          <SemanticButton
            action="play"
            component={Link}
            href={`/play?org=${org}`}
            variant="light"
          />
          <SemanticButton action="back" component={Link} href="/" variant="default" />
        </Group>
      </Stack>
    </PublicShell>
  );
}
