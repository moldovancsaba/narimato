import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { MantineProvider } from '@mantine/core';
import { narimatoTheme } from '../lib/ui/narimatoTheme';

/**
 * Root provider stack: Mantine + GDS (@gds/theme via narimatoTheme).
 */
export function NarimatoProviders({ children }) {
  return (
    <MantineProvider
      theme={narimatoTheme}
      withCssVariables
      withGlobalClasses
      defaultColorScheme="auto"
    >
      <ModalsProvider>
        <Notifications position="top-right" />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}
