import { Paper, Select, Stack, Text } from '@mantine/core';
import { FormField, StateBlock } from '@doneisbetter/gds-core/client';
import { gdsAccentPanelStyle } from '../../lib/ui/gdsSurfaces';

export function OperatorOrgPicker({
  organizations,
  orgId,
  onOrgChange,
  onCreateClick,
  compact = false,
}) {
  if (!organizations?.length) {
    return (
      <StateBlock
        variant="info"
        title="Create your organisation first"
        description="An organisation is the company or team that runs the survey — for example, your department or client."
        action={
          onCreateClick ? (
            <Text
              size="sm"
              fw={600}
              style={{ cursor: 'pointer' }}
              onClick={onCreateClick}
              component="span"
            >
              Go to Your organisation →
            </Text>
          ) : null
        }
        compact
      />
    );
  }

  const active = organizations.find((o) => o.uuid === orgId);

  return (
    <Paper withBorder p={compact ? 'sm' : 'md'} radius="md" style={gdsAccentPanelStyle('gray')}>
      <Stack gap="xs">
        <FormField label="Working on" description="All survey setup applies to this organisation">
          <Select
            data={organizations.map((o) => ({ value: o.uuid, label: o.name }))}
            value={orgId || null}
            onChange={onOrgChange}
            maw={420}
          />
        </FormField>
        {active && !compact ? (
          <Text size="xs" c="dimmed">
            Participants will see content from <Text span fw={600}>{active.name}</Text> after they enter the survey password.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
