import Link from 'next/link';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { EmptyState } from '@gds/core';
import { NarimatoShell } from '../NarimatoShell';
import { event } from '../../lib/analytics/ga';

const MODES = [
  { key: 'swipe-only', label: 'Swipe only', color: 'red' },
  { key: 'vote-only', label: 'Vote only', color: 'cyan' },
  { key: 'swipe-more', label: 'Swipe more', color: 'grape' },
  { key: 'vote-more', label: 'Vote more', color: 'blue' },
  { key: 'rank-only', label: 'Rank only', color: 'teal' },
  { key: 'rank-more', label: 'Rank more', color: 'orange' },
];

export function PlayOrgPicker({ organizations, loading }) {
  if (loading) {
    return (
      <NarimatoShell title="Play">
        <Loader />
      </NarimatoShell>
    );
  }

  return (
    <NarimatoShell title="Play">
      <Stack gap="lg">
        <Title order={1}>Select organization</Title>
        {organizations.length === 0 ? (
          <EmptyState
            title="No organizations"
            description="Create an organization before playing."
            action={
              <Button component={Link} href="/organizations">
                Create organization
              </Button>
            }
          />
        ) : (
          <Stack gap="md">
            {organizations.map((organization) => (
              <Paper key={organization.uuid} withBorder p="md" radius="md">
                <Title order={4}>{organization.name}</Title>
                <Button
                  component={Link}
                  href={`/play?org=${organization.uuid}`}
                  color="orange"
                  mt="sm"
                >
                  Select
                </Button>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </NarimatoShell>
  );
}

export function PlayDeckPicker({
  org,
  decks,
  showHidden,
  onShowHiddenChange,
}) {
  return (
    <NarimatoShell title="Play">
      <Stack gap="lg">
        <Title order={1}>Select deck</Title>
        <Checkbox
          label="(admin) Show hidden decks"
          checked={showHidden}
          onChange={(e) => onShowHiddenChange(e.currentTarget.checked)}
        />
        {decks.length === 0 ? (
          <EmptyState
            title="No playable decks"
            description="Add cards with parent hashtags to form decks."
            action={
              <Button component={Link} href={`/cards?org=${org}`}>
                Manage cards
              </Button>
            }
          />
        ) : (
          <Stack gap="md">
            {decks.map((deckInfo) => (
              <Paper key={deckInfo.tag} withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Title order={4} c="green">
                    {deckInfo.tag}
                  </Title>
                  <Badge color="green" variant="light">
                    {deckInfo.cards.length} cards
                  </Badge>
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
                          event('mode_selected', {
                            org,
                            deckTag: deckInfo.tag,
                            mode: mode.key,
                          });
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
    </NarimatoShell>
  );
}

export function PlayComplete({ org, deck }) {
  return (
    <NarimatoShell title="Play complete">
      <Stack align="center" gap="lg" py="xl">
        <Title order={1}>Play complete</Title>
        <Text c="dimmed" ta="center">
          You finished ranking all cards in {deck}.
        </Text>
        <Group>
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Play another deck
          </Button>
          <Button component={Link} href="/" variant="default">
            Home
          </Button>
        </Group>
      </Stack>
    </NarimatoShell>
  );
}
