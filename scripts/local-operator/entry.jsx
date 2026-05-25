import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { NarimatoProviders } from '../../components/NarimatoProviders';
import { OperatorApp } from '../../components/operator/OperatorApp';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <NarimatoProviders>
    <OperatorApp apiBase="" />
  </NarimatoProviders>
);
