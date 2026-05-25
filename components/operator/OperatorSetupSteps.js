import { Box, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { GdsIcons } from '@gds/core';
import { gdsAccentSurface } from '../../lib/ui/gdsSurfaces';

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
            bg={undefined}
            style={{
              backgroundColor: active ? gdsAccentSurface.violet : undefined,
              borderColor: done
                ? 'var(--mantine-color-green-4)'
                : active
                  ? 'var(--mantine-color-violet-4)'
                  : undefined,
            }}
          >
            <Group align="flex-start" wrap="nowrap" gap="md">
              <ThemeIcon
                size={36}
                radius="xl"
                variant={done ? 'filled' : active ? 'light' : 'default'}
                color={done ? 'green' : active ? 'violet' : 'gray'}
              >
                {done ? <GdsIcons.Check size="1.1rem" /> : <Text fw={700}>{index + 1}</Text>}
              </ThemeIcon>
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
