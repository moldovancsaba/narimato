import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppShell, Burger, Group, ScrollArea, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Organizations', href: '/organizations' },
  { label: 'Cards', href: '/cards' },
  { label: 'Play', href: '/play' },
  { label: 'Rankings', href: '/rankings' },
];

export function NarimatoShell({ title = 'NARIMATO', children }) {
  const [opened, { toggle }] = useDisclosure();
  const router = useRouter();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>{title}</Title>
          </Group>
          <Text size="xs" c="dimmed">
            v7.2
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea>
          {NAV.map((item) => (
            <Text
              key={item.href}
              component={Link}
              href={item.href}
              fw={router.pathname === item.href ? 700 : 400}
              c={router.pathname === item.href ? 'brand' : undefined}
              py="xs"
              style={{ display: 'block', textDecoration: 'none' }}
            >
              {item.label}
            </Text>
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
