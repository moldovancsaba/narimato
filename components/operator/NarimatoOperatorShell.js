import { AppShell, Burger, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { GdsIcons } from '@gds/core';
import { NarimatoThemeToggle } from '../NarimatoThemeToggle';
import { LOCAL_TEST_URL, NAV_SECTIONS, OPERATOR_EXTERNAL_LINKS } from './operatorCopy';

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
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" px="sm" mt="md" mb={4}>
            Related pages
          </Text>
          {OPERATOR_EXTERNAL_LINKS.map((item) => (
            <NavLink
              key={item.href}
              component="a"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              label={item.label}
              description={item.description}
              leftSection={<GdsIcons.Forward size="1rem" stroke={1.5} />}
              mb={4}
            />
          ))}
          <NavLink
            component="a"
            href={LOCAL_TEST_URL}
            target="_blank"
            rel="noreferrer"
            label="Preview public site (dev)"
            description="Next.js home when running npm run dev"
            leftSection={<GdsIcons.Home size="1rem" />}
            mt="md"
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
