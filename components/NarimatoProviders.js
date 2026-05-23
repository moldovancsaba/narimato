import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { MantineProvider } from '@mantine/core';
import { narimatoTheme } from '../lib/ui/narimatoTheme';

export function NarimatoProviders({ children }) {
  return (
    <MantineProvider theme={narimatoTheme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}
