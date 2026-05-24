import Link from 'next/link';
import { Anchor, Container, Group, Stack, Text } from '@mantine/core';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@narimato.com';

export function PublicFooter() {
  return (
    <Container size="lg" py="xl" px="md" component="footer">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text fw={600}>Contact</Text>
          <Text size="sm" c="dimmed">
            Questions about running a survey for your organisation?
          </Text>
          <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
            {CONTACT_EMAIL}
          </Anchor>
        </Stack>

        <Group gap="md" wrap="wrap">
          <Anchor component={Link} href="/privacy" size="sm">
            Privacy policy
          </Anchor>
          <Anchor component={Link} href="/terms" size="sm">
            Terms & conditions
          </Anchor>
          <Anchor component={Link} href="/cookies" size="sm">
            Cookie preferences
          </Anchor>
          <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
            Contact
          </Anchor>
        </Group>

        <Text size="xs" c="dimmed">
          © {new Date().getFullYear()} Narimato. All rights reserved.
        </Text>
      </Stack>
    </Container>
  );
}

export { CONTACT_EMAIL };
