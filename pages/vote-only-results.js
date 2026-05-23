import Link from 'next/link';
import { Button, Stack, Text, Title } from '@mantine/core';
import { NarimatoShell } from '../components/NarimatoShell';

export async function getServerSideProps({ res }) {
  if (res) {
    res.statusCode = 410;
  }
  return { props: {} };
}

export default function VoteOnlyResultsRemoved() {
  return (
    <NarimatoShell title="Unavailable">
      <Stack align="center" gap="md" py="xl">
        <Title order={1}>Vote-only results unavailable</Title>
        <Text c="dimmed" ta="center">
          Vote-only mode was removed. Results are no longer available.
        </Text>
        <Button component={Link} href="/play">
          Return to play
        </Button>
      </Stack>
    </NarimatoShell>
  );
}
