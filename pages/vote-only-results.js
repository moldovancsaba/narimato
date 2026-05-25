import Link from 'next/link';
import { Stack } from '@mantine/core';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { NarimatoSemanticButton } from '../components/NarimatoSemanticButton';

export async function getServerSideProps({ res }) {
  if (res) {
    res.statusCode = 410;
  }
  return { props: {} };
}

export default function VoteOnlyResultsRemoved() {
  return (
    <PublicShell>
      <Stack align="center" gap="md" py="xl">
        <NarimatoPageHeader
          title="Vote-only results unavailable"
          subtitle="Vote-only mode was removed. Results are no longer available."
        />
        <NarimatoSemanticButton action="play" component={Link} href="/play" />
      </Stack>
    </PublicShell>
  );
}
