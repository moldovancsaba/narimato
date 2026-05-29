'use client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { GdsProvider } from '@doneisbetter/gds-theme/client';
import { narimatoTheme } from '../lib/ui/narimatoTheme';

/**
 * Root provider: canonical GdsProvider from @doneisbetter/gds-theme with createPublicBrandTheme.
 */
export function NarimatoProviders({ children }) {
  return (
    <GdsProvider theme={narimatoTheme} defaultColorScheme="auto">
      {children}
    </GdsProvider>
  );
}
