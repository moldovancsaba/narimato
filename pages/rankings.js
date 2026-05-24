import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Button,
  Checkbox,
  Group,
  Image,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { EmptyState, StatusBadge } from '@gds/core';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { useSurveyGate } from '../lib/hooks/useSurveyGate';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function Rankings() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState(deck || 'all');
  const [showHidden, setShowHidden] = useState(() => router.query.includeHidden === 'true');

  useSurveyGate(org);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (org) {
      fetchCards();
      fetchRankings();
    }
  }, [org, selectedDeck, showHidden]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
      if (!org && data.organizations?.length > 0) {
        router.push(`/rankings?org=${data.organizations[0].uuid}`);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      const data = await res.json();
      setCards(Array.isArray(data.cards) ? data.cards : []);

      const deckGroups = {};
      data.cards?.forEach((card) => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) deckGroups[card.parentTag] = [];
          deckGroups[card.parentTag].push(card);
        }
      });

      const includeHidden = showHidden === true;
      const deckList = Object.entries(deckGroups)
        .filter(([, grpCards]) => grpCards.length >= 2)
        .filter(([tag]) => {
          const parent = data.cards.find((c) => c.name === tag);
          if (!parent) return true;
          return includeHidden ? true : parent.isPlayable !== false;
        })
        .map(([tag, grpCards]) => ({ tag, count: grpCards.length }));

      setDecks(deckList);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const fetchRankings = async () => {
    try {
      const params = new URLSearchParams({ organizationId: org });
      if (selectedDeck && selectedDeck !== 'all') {
        params.append('parentTag', selectedDeck);
      }
      const res = await fetch(`/api/cards/rankings?${params}`);
      const data = await res.json();
      setRankings(data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    }
  };

  const getCardDetails = (cardId) =>
    cards.find((card) => card.uuid === cardId) || {
      title: 'Unknown Card',
      description: '',
      parentTag: '',
    };

  const handleDeckChange = (deckTag) => {
    setSelectedDeck(deckTag);
    const params = new URLSearchParams({ org });
    if (deckTag !== 'all') params.append('deck', deckTag);
    router.push(`/rankings?${params}`);
  };

  if (loading) {
    return (
      <PublicShell containerSize="lg">
        <Loader />
      </PublicShell>
    );
  }

  return (
    <PublicShell containerSize="lg">
      <Stack gap="lg">
        <NarimatoPageHeader
          title="Global rankings"
          subtitle="ELO ratings across all users"
        />

        <div>
          <Text fw={600} mb="xs">
            Organization
          </Text>
          <Group gap="xs">
            {organizations.map((organization) => (
              <Button
                key={organization.uuid}
                component={Link}
                href={`/rankings?org=${organization.uuid}`}
                variant={org === organization.uuid ? 'filled' : 'light'}
                size="sm"
              >
                {organization.name}
              </Button>
            ))}
          </Group>
        </div>

        {org ? (
          <>
            <Checkbox
              label="(admin) Show hidden decks"
              checked={showHidden}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setShowHidden(checked);
                const params = new URLSearchParams(router.query);
                if (checked) params.set('includeHidden', 'true');
                else params.delete('includeHidden');
                router.replace(
                  { pathname: router.pathname, query: Object.fromEntries(params.entries()) },
                  undefined,
                  { shallow: true }
                );
              }}
            />

            <Group gap="xs">
              <Button
                size="sm"
                variant={selectedDeck === 'all' ? 'filled' : 'light'}
                onClick={() => handleDeckChange('all')}
              >
                All decks ({rankings.length})
              </Button>
              {decks.map((deckInfo) => (
                <Button
                  key={deckInfo.tag}
                  size="sm"
                  variant={selectedDeck === deckInfo.tag ? 'filled' : 'light'}
                  onClick={() => handleDeckChange(deckInfo.tag)}
                >
                  {deckInfo.tag} ({deckInfo.count})
                </Button>
              ))}
            </Group>

            {rankings.length === 0 ? (
              <EmptyState
                title="No rankings yet"
                description="Rankings appear after users play and vote."
                action={
                  <Button component={Link} href={`/play?org=${org}`} color="orange">
                    Start playing
                  </Button>
                }
              />
            ) : (
              <Paper withBorder radius="md">
                <Table.ScrollContainer minWidth={700}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Rank</Table.Th>
                        <Table.Th>Card</Table.Th>
                        <Table.Th>ELO</Table.Th>
                        <Table.Th>Votes</Table.Th>
                        <Table.Th>Wins</Table.Th>
                        <Table.Th>Win %</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rankings.map((ranking, index) => {
                        const card = getCardDetails(ranking.cardId);
                        return (
                          <Table.Tr key={ranking.cardId}>
                            <Table.Td>
                              {index < 3 ? RANK_MEDALS[index] : `#${index + 1}`}
                            </Table.Td>
                            <Table.Td>
                              <Group gap="sm" wrap="nowrap">
                                {card.imageUrl ? (
                                  <Image src={card.imageUrl} w={48} h={48} radius="sm" alt="" />
                                ) : null}
                                <div>
                                  <Text fw={500}>{card.title}</Text>
                                  {card.parentTag ? (
                                    <StatusBadge size="xs" status="success" variant="light">
                                      {card.parentTag}
                                    </StatusBadge>
                                  ) : null}
                                </div>
                              </Group>
                            </Table.Td>
                            <Table.Td fw={700}>{ranking.globalScore}</Table.Td>
                            <Table.Td>{ranking.voteCount}</Table.Td>
                            <Table.Td>{ranking.winCount}</Table.Td>
                            <Table.Td>{ranking.winRate}%</Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            )}

            <Group justify="center">
              <Button component={Link} href={`/play?org=${org}`} color="orange">
                Play
              </Button>
              <Button component={Link} href={`/cards?org=${org}`} variant="light">
                Manage cards
              </Button>
            </Group>
          </>
        ) : null}
      </Stack>
    </PublicShell>
  );
}
