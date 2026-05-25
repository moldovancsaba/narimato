import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { GdsIcons } from '@gds/core';
import { gdsAccentPanelStyle } from '../../lib/ui/gdsSurfaces';

function stepIndicatorStyle(done, active) {
  if (done) return gdsAccentPanelStyle('green');
  if (active) return gdsAccentPanelStyle('violet');
  return {
    backgroundColor: 'var(--mantine-color-body)',
    border: '1px solid var(--mantine-color-default-border)',
  };
}

export function OperatorSetupSteps({ steps }) {
  return (
    <Stack gap="sm">
      {steps.map((step, index) => {
        const done = step.done;
        const active = step.active;

        return (
          <Paper
            key={step.id || step.label}
            withBorder
            p="md"
            radius="md"
            style={active ? gdsAccentPanelStyle('violet') : undefined}
          >
            <Group align="flex-start" wrap="nowrap" gap="md">
              <Box
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  ...stepIndicatorStyle(done, active),
                }}
              >
                {done ? <GdsIcons.Check size="1.1rem" /> : <Text fw={700}>{index + 1}</Text>}
              </Box>
              <Box style={{ flex: 1 }}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4}>
                    <Text fw={600}>{step.label}</Text>
                    {step.detail ? (
                      <Text size="sm" c="dimmed">
                        {step.detail}
                      </Text>
                    ) : null}
                  </Stack>
                  {step.action || null}
                </Group>
              </Box>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
