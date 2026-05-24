import Link from 'next/link';
import { PublicShell } from '../components/public/PublicShell';
import { NarimatoPageHeader } from '../components/NarimatoPageHeader';
import { CONTACT_EMAIL } from '../components/public/PublicFooter';
import { Anchor, List, Stack, Text, Title } from '@mantine/core';

export default function PrivacyPage() {
  return (
    <PublicShell containerSize="md">
      <Stack gap="lg">
        <NarimatoPageHeader
          title="Privacy policy"
          subtitle="Last updated: 23 May 2026 · Applies to narimato.com"
        />

        <Section title="1. Who we are">
          <Text size="sm" c="dimmed">
            Narimato (&quot;we&quot;, &quot;us&quot;) operates narimato.com, a platform that lets organisations run
            preference surveys through swipe-and-rank interactions. For privacy enquiries contact{' '}
            <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
              {CONTACT_EMAIL}
            </Anchor>
            .
          </Text>
        </Section>

        <Section title="2. Roles: controller vs processor">
          <Text size="sm" c="dimmed">
            When you visit narimato.com as a survey participant, the organisation that issued your survey password is
            typically the <strong>data controller</strong> for survey content and results. Narimato acts as a{' '}
            <strong>data processor</strong> for that organisation, hosting the technical infrastructure. For
            questions about how your answers are used, contact your survey organiser first.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            For website analytics, cookie preferences, and platform operations, Narimato is the controller.
          </Text>
        </Section>

        <Section title="3. Data we process">
          <List size="sm" c="dimmed" spacing="xs">
            <List.Item>
              <strong>Survey access:</strong> passwords are verified using salted hashes; plain passwords are not
              stored. A session cookie (`narimato-survey-access`) keeps you signed in to your survey for up to 30 days.
            </List.Item>
            <List.Item>
              <strong>Survey responses:</strong> ranking choices, swipe/vote actions, session identifiers, and
              timestamps needed to produce results.
            </List.Item>
            <List.Item>
              <strong>Technical data:</strong> browser type, device category, approximate usage metrics, and server
              logs for security and reliability.
            </List.Item>
            <List.Item>
              <strong>Analytics (optional):</strong> if you consent, Google Analytics 4 with IP anonymisation and
              Consent Mode v2.
            </List.Item>
          </List>
        </Section>

        <Section title="4. Legal bases (EEA / UK GDPR)">
          <List size="sm" c="dimmed" spacing="xs">
            <List.Item>
              <strong>Contract / legitimate steps:</strong> providing survey access after you enter a valid password.
            </List.Item>
            <List.Item>
              <strong>Legitimate interests:</strong> securing the service, preventing abuse, and improving reliability.
            </List.Item>
            <List.Item>
              <strong>Consent:</strong> non-essential analytics cookies (you can withdraw consent at any time on the{' '}
              <Anchor component={Link} href="/cookies" size="sm">
                cookie preferences
              </Anchor>{' '}
              page).
            </List.Item>
            <List.Item>
              <strong>Organisation&apos;s legal basis:</strong> survey content and use of results are determined by
              the organising entity.
            </List.Item>
          </List>
        </Section>

        <Section title="5. Cookies">
          <Text size="sm" c="dimmed">
            Essential cookies are required for survey sessions. Analytics cookies are optional. Full details and
            controls are on our{' '}
            <Anchor component={Link} href="/cookies" size="sm">
              cookie preferences
            </Anchor>{' '}
            page.
          </Text>
        </Section>

        <Section title="6. Sharing & international transfers">
          <Text size="sm" c="dimmed">
            We use infrastructure providers (e.g. hosting) that may process data in the EU and other regions. Analytics
            data may be processed by Google where enabled. We do not sell personal data.
          </Text>
        </Section>

        <Section title="7. Retention">
          <Text size="sm" c="dimmed">
            Survey session cookies expire after 30 days of inactivity. Play and ranking records are retained according
            to each organisation&apos;s configuration on the Narimato platform. Server logs are kept for a limited
            period for security. Contact your organiser for survey-specific retention schedules.
          </Text>
        </Section>

        <Section title="8. Your rights">
          <Text size="sm" c="dimmed">
            If you are in the EEA, UK, or similar jurisdictions you may have rights to access, rectify, erase,
            restrict, object, and port your data, and to withdraw consent where processing is consent-based. You may
            lodge a complaint with your local supervisory authority.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Submit requests to{' '}
            <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
              {CONTACT_EMAIL}
            </Anchor>
            . We respond within one month where GDPR applies.
          </Text>
        </Section>

        <Section title="9. Children">
          <Text size="sm" c="dimmed">
            Narimato is not directed at children under 16. Organisations must not invite minors to participate without
            appropriate parental authority and lawful basis.
          </Text>
        </Section>

        <Section title="10. Changes">
          <Text size="sm" c="dimmed">
            We may update this policy. Material changes will be reflected on this page with a revised date.
          </Text>
        </Section>
      </Stack>
    </PublicShell>
  );
}

function Section({ title, children }) {
  return (
    <Stack gap="xs">
      <Title order={4}>{title}</Title>
      {children}
    </Stack>
  );
}
