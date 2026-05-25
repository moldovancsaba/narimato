import Link from 'next/link';
import {
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Title,
} from '@mantine/core';
import { EmptyState, StatusBadge } from '@gds/core';
import { PublicShell } from '../public/PublicShell';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { NarimatoChoiceChip } from '../NarimatoChoiceChip';
import { NarimatoSemanticButton } from '../NarimatoSemanticButton';
import { event } from '../../lib/analytics/ga';

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
      <PublicShell>
        <Loader />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Stack gap="lg">
        <NarimatoPageHeader title="Select survey" subtitle="Choose your organisation's survey to continue." />
        {organizations.length === 0 ? (
          <EmptyState
            title="No surveys available"
            description="Enter your survey password on the home page, or contact your organiser."
            action={
              <NarimatoSemanticButton action="back" component={Link} href="/" />
            }
          />
        ) : (
          <Stack gap="md">
            {organizations.map((organization) => (
              <Paper key={organization.uuid} withBorder p="md" radius="md">
                <Title order={4}>{organization.name}</Title>
                <NarimatoSemanticButton
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
    <PublicShell>
      <Stack gap="lg">
        <NarimatoPageHeader title="Select deck" subtitle="Pick a deck to start ranking." />
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
              <NarimatoSemanticButton action="back" component={Link} href="/" />
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
                    <NarimatoChoiceChip
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
    <PublicShell>
      <Stack align="center" gap="lg" py="xl">
        <NarimatoPageHeader
          title="Survey complete"
          subtitle={`You finished ranking all cards in ${deck}.`}
        />
        <Group>
          <NarimatoSemanticButton
            action="play"
            component={Link}
            href={`/play?org=${org}`}
            variant="light"
          />
          <NarimatoSemanticButton action="back" component={Link} href="/" variant="default" />
        </Group>
      </Stack>
    </PublicShell>
  );
}
