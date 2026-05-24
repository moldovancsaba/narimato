import { Box, Stack, Text } from '@mantine/core';

/**
 * GDS FormField pattern for Narimato (SSR-safe; mirrors @gds/core FormField).
 */
export function NarimatoFormField({ label, description, error, children }) {
  return (
    <Box component="label">
      <Stack gap={4}>
        <Text size="xs" fw={600} c="dimmed">
          {label}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
        {children}
        {error ? (
          <Text size="xs" c="red.7">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
