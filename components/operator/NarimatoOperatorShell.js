import { useState } from 'react';
import Link from 'next/link';
import { AppShell, Burger, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { GdsIcons } from '@gds/core';
import { NarimatoThemeToggle } from '../NarimatoThemeToggle';
import { NAV_SECTIONS } from './operatorCopy';

const TAB_ICONS = {
  dashboard: GdsIcons.Home,
  organizations: GdsIcons.Users,
  survey: GdsIcons.Play,
  cards: GdsIcons.Grid,
  intelligence: GdsIcons.Settings,
};

/** @deprecated use NAV_SECTIONS from operatorCopy */
export const OPERATOR_TABS = NAV_SECTIONS.flatMap((section) => section.tabs);

export function NarimatoOperatorShell({ activeTab, onTabChange, children }) {
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 280, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="md" aria-label="Navigation" />
            <Stack gap={0}>
              <Text fw={700} size="sm" lh={1.2}>
                Narimato Setup
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="sm">
                Prepare surveys on your computer
              </Text>
            </Stack>
          </Group>
          <Group gap="sm">
            <NarimatoThemeToggle size="md" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea>
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <Stack key={section.title} gap={4} mb={sectionIndex < NAV_SECTIONS.length - 1 ? 'md' : 0}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" px="sm" mb={4}>
                {section.title}
              </Text>
              {section.tabs.map((tab) => {
                const Icon = TAB_ICONS[tab.id] || GdsIcons.Dashboard;
                return (
                  <NavLink
                    key={tab.id}
                    label={tab.label}
                    description={tab.description}
                    leftSection={<Icon size="1rem" stroke={1.5} />}
                    active={activeTab === tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      close();
                    }}
                    mb={4}
                  />
                );
              })}
            </Stack>
          ))}
          <NavLink
            component={Link}
            href="/"
            label="Preview public site"
            description="See what participants see"
            leftSection={<GdsIcons.Home size="1rem" />}
            mt="md"
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
