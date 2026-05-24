import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Button,
  Group,
  Image,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { StatusBadge } from '@gds/core';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { useSurveyGate } from '../lib/hooks/useSurveyGate';

export default function SwipeOnlyResults() {
  const router = useRouter();
  const { playId, org } = router.query;
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useSurveyGate(org);

  useEffect(() => {
    if (playId) fetchResults();
  }, [playId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/swipe-only/${playId}/results`);
      if (res.ok) setResults(await res.json());
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PublicShell containerSize="lg">
        <Loader />
      </PublicShell>
    );
  }

  if (!results) {
    return (
      <PublicShell containerSize="lg">
        <Stack gap="md">
          <NarimatoPageHeader title="Results not found" />
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Back to play
          </Button>
        </Stack>
      </PublicShell>
    );
  }

  return (
    <PublicShell containerSize="lg">
      <Stack gap="lg">
        <NarimatoPageHeader
          title="Swipe results"
          subtitle={`Deck: ${results.sessionInfo.deckTag}`}
        />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Text fw={600}>Total cards</Text>
            <Text>{results.statistics.totalCards}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md" bg="green.0">
            <Text fw={600}>Liked</Text>
            <Text>{results.statistics.likedCards}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md" bg="red.0">
            <Text fw={600}>Rejected</Text>
            <Text>{results.statistics.rejectedCards}</Text>
          </Paper>
        </SimpleGrid>

        <Text fw={600} mb="sm">
          Your ranking
        </Text>
        {results.ranking.length > 0 ? (
          <Stack gap="sm">
            {results.ranking.map((item, index) => (
              <Paper key={item.card.id} withBorder p="md" radius="md">
                <Group wrap="nowrap">
                  <StatusBadge size="lg" status={index < 3 ? 'warning' : 'neutral'}>
                    #{item.rank}
                  </StatusBadge>
                  <div style={{ flex: 1 }}>
                    <Text fw={600}>{item.card.title}</Text>
                    {item.card.description ? (
                      <Text size="sm" c="dimmed">
                        {item.card.description}
                      </Text>
                    ) : null}
                  </div>
                  {item.card.imageUrl ? (
                    <Image src={item.card.imageUrl} w={60} h={60} radius="sm" alt="" />
                  ) : null}
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">No cards were liked in this session.</Text>
        )}

        <Button component={Link} href={`/play?org=${org}`}>
          Rank another deck
        </Button>
      </Stack>
    </PublicShell>
  );
}
