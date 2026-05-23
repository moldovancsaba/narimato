import Link from 'next/link';
import { Button, List, Paper, Stack, Text, Title, SimpleGrid, ThemeIcon } from '@mantine/core';
import { IconCards, IconBuilding, IconPlayerPlay, IconChartBar } from '@tabler/icons-react';
import { NarimatoShell } from '../components/NarimatoShell';

export default function Home() {
  return (
    <NarimatoShell title="NARIMATO">
      <Stack gap="lg">
        <Title order={1}>Card ranking system</Title>
        <Text c="dimmed">
          Organizations, hashtag decks, swipe and vote play modes, personal and global rankings.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <ThemeIcon size="lg" variant="light" mb="sm">
              <IconBuilding />
            </ThemeIcon>
            <Text fw={600}>Organizations</Text>
            <Text size="sm" c="dimmed">
              Manage tenant groups and isolated card databases.
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <ThemeIcon size="lg" variant="light" mb="sm">
              <IconCards />
            </ThemeIcon>
            <Text fw={600}>Cards & decks</Text>
            <Text size="sm" c="dimmed">
              Hashtag hierarchy; parents with children become playable decks.
            </Text>
          </Paper>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }} spacing="sm">
          <Button component={Link} href="/organizations" variant="light">
            Organizations
          </Button>
          <Button component={Link} href="/cards" variant="filled">
            Cards
          </Button>
          <Button component={Link} href="/play" color="orange" variant="filled">
            Play
          </Button>
          <Button component={Link} href="/rankings" color="dark" variant="outline">
            Rankings
          </Button>
        </SimpleGrid>

        <Paper withBorder p="md" radius="md" bg="gray.0">
          <Title order={3} mb="sm">
            How it works
          </Title>
          <List type="ordered" spacing="xs">
            <List.Item>Create an organization</List.Item>
            <List.Item>Add cards with parent hashtags (e.g. #food → #pizza)</List.Item>
            <List.Item>Parent cards with children become decks</List.Item>
            <List.Item>Play: swipe and/or vote to rank</List.Item>
            <List.Item>View personal results and global ELO rankings</List.Item>
          </List>
        </Paper>
      </Stack>
    </NarimatoShell>
  );
}
