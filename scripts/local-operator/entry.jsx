import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { NarimatoProviders } from '../../components/NarimatoProviders';
import { OperatorApp } from '../../components/operator/OperatorApp';

createRoot(document.getElementById('root')).render(
  <NarimatoProviders>
    <OperatorApp apiBase="" />
  </NarimatoProviders>
);
