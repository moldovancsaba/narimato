import { Alert, Anchor, Text } from '@mantine/core';

const OPERATOR_URL = 'http://127.0.0.1:10006';

export function LocalOperatorNotice({ compact = false }) {
  return (
    <Alert color="blue" variant="light" title="Local operator console">
      <Text size="sm">
        {compact
          ? 'Card and org management runs on your Mac at '
          : 'All management (organizations, cards, topic clarification, generation approval) runs on your Mac at '}
        <Anchor href={OPERATOR_URL} target="_blank" rel="noopener noreferrer">
          {OPERATOR_URL}
        </Anchor>
        . Double-click <strong>Open Narimato Local AI</strong> on your Desktop, or run{' '}
        <code>npm run intelligence:open</code> (install shortcut: <code>npm run intelligence:desktop</code>
        ).
      </Text>
    </Alert>
  );
}
