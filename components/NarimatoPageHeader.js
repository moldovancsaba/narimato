import { Box } from '@mantine/core';
import { PageHeader } from '@gds/core/server';

/**
 * Narimato adapter for GDS PageHeader (maps subtitle → description).
 */
export function NarimatoPageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <Box mb="lg">
      <PageHeader title={title} description={subtitle} actions={actions} eyebrow={eyebrow} />
    </Box>
  );
}
