import Link from 'next/link';
import { Anchor, Group, Text } from '@mantine/core';
import { PublicBrandFooter, PublicNav } from '@doneisbetter/gds-core/server';
import { NarimatoThemeToggle } from '../../components/NarimatoThemeToggle';

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@narimato.com';

const NAV_ITEMS = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'privacy', href: '/privacy', label: 'Privacy' },
  { id: 'terms', href: '/terms', label: 'Terms' },
  { id: 'cookies', href: '/cookies', label: 'Cookies' },
];

function renderPublicLink(item, active) {
  return (
    <Anchor
      component={Link}
      href={item.href}
      aria-current={active ? 'page' : undefined}
      c={active ? 'var(--mantine-color-text)' : 'dimmed'}
      fw={active ? 700 : 500}
      underline="never"
    >
      {item.label}
    </Anchor>
  );
}

function renderMobileLink(item, active) {
  return (
    <Text
      key={item.id}
      component={Link}
      href={item.href}
      size="sm"
      fw={active ? 700 : 500}
      c={active ? 'var(--mantine-color-text)' : 'dimmed'}
      style={{ textDecoration: 'none' }}
    >
      {item.label}
    </Text>
  );
}

export function getPublicShellProps(activeNavId, { containerSize = 'sm' } = {}) {
  return {
    brand: (
      <Text component={Link} href="/" fw={800} size="lg" c="violet" style={{ textDecoration: 'none' }}>
        NARIMATO
      </Text>
    ),
    navigation: <PublicNav items={NAV_ITEMS} activeId={activeNavId} renderLink={renderPublicLink} />,
    mobileNavigation: NAV_ITEMS.map((item) => renderMobileLink(item, item.id === activeNavId)),
    mobileNavigationMode: 'inline-collapse',
    headerVariant: 'branded-quiet',
    maxContentWidth: containerSize,
    actions: (
      <Group gap="sm">
        <Text size="xs" c="dimmed" visibleFrom="sm">
          Deep surveys, done fast
        </Text>
        <NarimatoThemeToggle size="md" />
      </Group>
    ),
    footer: (
      <PublicBrandFooter
        brandTitle="Contact"
        description="Questions about running a survey for your organisation?"
        actions={
          <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
            {CONTACT_EMAIL}
          </Anchor>
        }
        legal={
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
            <Text size="xs" c="dimmed">
              © {new Date().getFullYear()} Narimato. All rights reserved.
            </Text>
          </Group>
        }
      />
    ),
  };
}
