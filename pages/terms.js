import Link from 'next/link';
import { PageHeader as NarimatoPageHeader, PublicShell } from '@doneisbetter/gds-core/server';
import { Anchor, List, Stack, Text, Title } from '@mantine/core';
import { CONTACT_EMAIL, getPublicShellProps } from '../lib/ui/publicChrome';

export default function TermsPage() {
  return (
    <PublicShell {...getPublicShellProps('terms', { containerSize: 'md' })}>
      <Stack gap="lg">
        <NarimatoPageHeader
          title="Terms & conditions"
          subtitle="Last updated: 23 May 2026 · Applies to narimato.com"
        />

        <Section title="1. Agreement">
          <Text size="sm" c="dimmed">
            By accessing narimato.com you agree to these terms. If you do not agree, do not use the site. These terms
            govern the public website and participant experience; organisations configure surveys through separate
            local operator tools.
          </Text>
        </Section>

        <Section title="2. The service">
          <Text size="sm" c="dimmed">
            Narimato enables organisations to run preference surveys where participants rank or swipe through options.
            The public site lets participants enter a survey password, complete a session, and view results where
            made available by the organiser.
          </Text>
        </Section>

        <Section title="3. Survey passwords & access">
          <List size="sm" c="dimmed" spacing="xs">
            <List.Item>Passwords are issued by your organisation; do not share them publicly.</List.Item>
            <List.Item>Use only passwords intended for you; unauthorised access is prohibited.</List.Item>
            <List.Item>We may suspend access to protect the service or other participants.</List.Item>
          </List>
        </Section>

        <Section title="4. Acceptable use">
          <Text size="sm" c="dimmed">You agree not to:</Text>
          <List size="sm" c="dimmed" spacing="xs" mt="xs">
            <List.Item>Bypass access controls or attempt to access other organisations&apos; surveys.</List.Item>
            <List.Item>Scrape, reverse-engineer, or overload the platform.</List.Item>
            <List.Item>Submit unlawful, harmful, or misleading content if free-text fields are offered.</List.Item>
            <List.Item>Interfere with other participants or manipulate results in bad faith.</List.Item>
          </List>
        </Section>

        <Section title="5. Organiser responsibility">
          <Text size="sm" c="dimmed">
            Organisations using Narimato are responsible for survey content, lawful basis for processing participant
            data, participant communications, and how results are used. Narimato provides the technical platform only.
          </Text>
        </Section>

        <Section title="6. Results disclaimer">
          <Text size="sm" c="dimmed">
            Rankings and scores reflect preferences expressed in a session under the survey design provided by the
            organiser. Results are provided &quot;as is&quot; without warranty of accuracy, completeness, or fitness for
            a particular decision. Do not rely on Narimato as the sole basis for legal, medical, financial, or safety
            decisions.
          </Text>
        </Section>

        <Section title="7. Intellectual property">
          <Text size="sm" c="dimmed">
            The Narimato name, site design, and software are protected. Survey content (cards, images, text) belongs
            to the respective organisation or licensors.
          </Text>
        </Section>

        <Section title="8. Privacy & cookies">
          <Text size="sm" c="dimmed">
            Our processing of personal data is described in the{' '}
            <Anchor component={Link} href="/privacy" size="sm">
              privacy policy
            </Anchor>
            . Cookie use is described on the{' '}
            <Anchor component={Link} href="/cookies" size="sm">
              cookie preferences
            </Anchor>{' '}
            page.
          </Text>
        </Section>

        <Section title="9. Limitation of liability">
          <Text size="sm" c="dimmed">
            To the maximum extent permitted by applicable law, Narimato is not liable for indirect, incidental, or
            consequential damages arising from use of the site. Nothing in these terms limits liability where it
            cannot be limited by law (including death or personal injury caused by negligence, or fraud).
          </Text>
        </Section>

        <Section title="10. Changes & termination">
          <Text size="sm" c="dimmed">
            We may modify these terms or discontinue features. Continued use after changes constitutes acceptance.
            Material updates will be posted on this page.
          </Text>
        </Section>

        <Section title="11. Governing law">
          <Text size="sm" c="dimmed">
            These terms are governed by the laws of Romania, without prejudice to mandatory consumer protections in
            your country of residence within the EEA or UK. Disputes should first be raised with{' '}
            <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
              {CONTACT_EMAIL}
            </Anchor>
            .
          </Text>
        </Section>

        <Section title="12. Contact">
          <Text size="sm" c="dimmed">
            Questions about these terms:{' '}
            <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm">
              {CONTACT_EMAIL}
            </Anchor>
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
