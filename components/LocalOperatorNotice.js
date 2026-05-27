import { Anchor, Text } from '@mantine/core';
import { StateBlock } from '@doneisbetter/gds-core/client';

const OPERATOR_URL = 'http://127.0.0.1:10006';

export function LocalOperatorNotice({ compact = false }) {
  return (
    <StateBlock
      variant="info"
      title="Local operator console"
      description={
        compact
          ? 'Card and org management runs on your Mac (link below).'
          : 'All management runs on your Mac (link below).'
      }
      action={
        <Text size="sm">
          <Anchor href={OPERATOR_URL} target="_blank" rel="noopener noreferrer">
            {OPERATOR_URL}
          </Anchor>
          . Double-click <strong>Open Narimato Local AI</strong> on your Desktop, or run{' '}
          <code>npm run intelligence:open</code> (install: <code>npm run intelligence:desktop</code>).
        </Text>
      }
    />
  );
}
