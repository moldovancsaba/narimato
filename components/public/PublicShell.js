import Link from 'next/link';
import { AppShell, Burger, Container, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PublicFooter } from './PublicFooter';
import { NarimatoThemeToggle } from '../NarimatoThemeToggle';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
];

export function PublicShell({ children, containerSize = 'sm' }) {
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      padding={0}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Text
              component={Link}
              href="/"
              fw={800}
              size="lg"
              c="violet"
              style={{ textDecoration: 'none' }}
              onClick={close}
            >
              NARIMATO
            </Text>
          </Group>
          <Group gap="sm">
            <Text size="xs" c="dimmed" visibleFrom="sm">
              Deep surveys, done fast
            </Text>
            <NarimatoThemeToggle size="md" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" hiddenFrom="sm">
        <Stack gap="sm">
          {NAV_LINKS.map((link) => (
            <Text
              key={link.href}
              component={Link}
              href={link.href}
              size="sm"
              fw={link.href === '/' ? 600 : 400}
              onClick={close}
              style={{ textDecoration: 'none' }}
            >
              {link.label}
            </Text>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size={containerSize} py="xl" px="md">
          {children}
        </Container>
        <PublicFooter />
      </AppShell.Main>
    </AppShell>
  );
}
