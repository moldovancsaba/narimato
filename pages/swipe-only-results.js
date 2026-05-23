import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Badge,
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
import { NarimatoShell } from '../components/NarimatoShell';

export default function SwipeOnlyResults() {
  const router = useRouter();
  const { playId, org } = router.query;
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <NarimatoShell title="Swipe results">
        <Loader />
      </NarimatoShell>
    );
  }

  if (!results) {
    return (
      <NarimatoShell title="Swipe results">
        <Stack gap="md">
          <Title order={2}>Results not found</Title>
          <Button component={Link} href={`/play?org=${org}`} variant="light">
            Back to play
          </Button>
        </Stack>
      </NarimatoShell>
    );
  }

  return (
    <NarimatoShell title="Swipe results">
      <Stack gap="lg">
        <Title order={1}>Swipe results</Title>
        <Text c="dimmed">Deck: {results.sessionInfo.deckTag}</Text>

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

        <Title order={2}>Your ranking</Title>
        {results.ranking.length > 0 ? (
          <Stack gap="sm">
            {results.ranking.map((item, index) => (
              <Paper key={item.card.id} withBorder p="md" radius="md">
                <Group wrap="nowrap">
                  <Badge size="lg" color={index < 3 ? 'yellow' : 'gray'}>
                    #{item.rank}
                  </Badge>
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
    </NarimatoShell>
  );
}
