import { Alert, Paper, Select, Stack, Text } from '@mantine/core';
import { NarimatoFormField } from '../NarimatoFormField';
import { gdsAccentSurface } from '../../lib/ui/gdsSurfaces';

export function OperatorOrgPicker({
  organizations,
  orgId,
  onOrgChange,
  onCreateClick,
  compact = false,
}) {
  if (!organizations?.length) {
    return (
      <Alert
        title="Create your organisation first"
        color="violet"
        variant="light"
      >
        <Stack gap="xs">
          <Text size="sm">
            An organisation is the company or team that runs the survey — for example, your department or client.
          </Text>
          {onCreateClick ? (
            <Text
              size="sm"
              c="violet"
              fw={600}
              style={{ cursor: 'pointer' }}
              onClick={onCreateClick}
              component="span"
            >
              Go to Your organisation →
            </Text>
          ) : null}
        </Stack>
      </Alert>
    );
  }

  const active = organizations.find((o) => o.uuid === orgId);

  return (
    <Paper
      withBorder
      p={compact ? 'sm' : 'md'}
      radius="md"
      style={{ backgroundColor: gdsAccentSurface.gray }}
    >
      <Stack gap="xs">
        <NarimatoFormField label="Working on" description="All survey setup applies to this organisation">
          <Select
            data={organizations.map((o) => ({ value: o.uuid, label: o.name }))}
            value={orgId || null}
            onChange={onOrgChange}
            maw={420}
          />
        </NarimatoFormField>
        {active && !compact ? (
          <Text size="xs" c="dimmed">
            Participants will see content from <Text span fw={600}>{active.name}</Text> after they enter the survey password.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
