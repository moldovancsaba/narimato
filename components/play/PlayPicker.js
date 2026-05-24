import Link from 'next/link';
import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Title,
} from '@mantine/core';
import { EmptyState, StatusBadge } from '@gds/core';
import { PublicShell } from '../public/PublicShell';
import { NarimatoPageHeader } from '../NarimatoPageHeader';
import { event } from '../../lib/analytics/ga';

const MODES = [
  { key: 'swipe-only', label: 'Swipe only', color: 'red' },
  { key: 'vote-only', label: 'Vote only', color: 'cyan' },
  { key: 'swipe-more', label: 'Swipe more', color: 'grape' },
  { key: 'vote-more', label: 'Vote more', color: 'blue' },
  { key: 'rank-only', label: 'Rank only', color: 'teal' },
  { key: 'rank-more', label: 'Rank more', color: 'orange' },
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
              <Button component={Link} href="/">
                Back to home
              </Button>
            }
          />
        ) : (
          <Stack gap="md">
            {organizations.map((organization) => (
              <Paper key={organization.uuid} withBorder p="md" radius="md">
                <Title order={4}>{organization.name}</Title>
                <Button component={Link} href={`/play?org=${organization.uuid}`} color="violet" mt="sm">
                  Open survey
                </Button>
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
              <Button component={Link} href="/">
                Home
              </Button>
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
                    <Button
                      key={mode.key}
                      component={Link}
                      href={`/play?org=${org}&deck=${encodeURIComponent(deckInfo.tag)}&mode=${mode.key}`}
                      size="xs"
                      color={mode.color}
                      onClick={() => {
                        try {
                          event('mode_selected', { org, deckTag: deckInfo.tag, mode: mode.key });
                        } catch {
                          /* noop */
                        }
                      }}
                    >
                      {mode.label}
                    </Button>
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
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Play another deck
          </Button>
          <Button component={Link} href="/" variant="default">
            Home
          </Button>
        </Group>
      </Stack>
    </PublicShell>
  );
}
