import { NavLink } from '@mantine/core';
import { AppShell } from '@doneisbetter/gds-admin/client';
import { GdsIcons } from '@doneisbetter/gds-core/client';
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
  const primaryNavigation = NAV_SECTIONS.map((section) =>
    section.tabs.map((tab) => {
      const Icon = TAB_ICONS[tab.id] || GdsIcons.Dashboard;
      return (
        <NavLink
          key={tab.id}
          label={tab.label}
          description={tab.description}
          leftSection={<Icon size="1rem" stroke={1.5} />}
          active={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          mb={4}
        />
      );
    })
  );

  const secondaryNavigation = OPERATOR_EXTERNAL_LINKS.map((item) => (
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
  ));

  const accountPanel = (
    <NavLink
      component="a"
      href={LOCAL_TEST_URL}
      target="_blank"
      rel="noreferrer"
      label="Preview public site (dev)"
      description="Next.js home when running npm run dev"
      leftSection={<GdsIcons.Home size="1rem" />}
    />
  );

  return (
    <AppShell
      logoText="Narimato Setup"
      headerContext="Prepare surveys on your computer"
      primaryNavigation={primaryNavigation}
      secondaryNavigation={secondaryNavigation}
      accountPanel={accountPanel}
    >
      {children}
    </AppShell>
  );
}
