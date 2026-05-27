import Link from 'next/link';
import { Stack } from '@mantine/core';
import { SemanticButton as NarimatoSemanticButton } from '@doneisbetter/gds-core/client';
import { PageHeader as NarimatoPageHeader, PublicShell } from '@doneisbetter/gds-core/server';
import { getPublicShellProps } from '../lib/ui/publicChrome';

export async function getServerSideProps({ res }) {
  if (res) {
    res.statusCode = 410;
  }
  return { props: {} };
}

export default function VoteOnlyResultsRemoved() {
  return (
    <PublicShell {...getPublicShellProps('home')}>
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
