/** Plain-language labels for the local setup UI. */

export const LOCAL_TEST_URL =
  typeof process !== 'undefined' && process.env?.NARIMATO_WEBAPP_URL
    ? process.env.NARIMATO_WEBAPP_URL
    : 'http://localhost:3000';
export const PUBLIC_SITE_URL = 'https://www.narimato.com';
export const OPERATOR_URL = 'http://127.0.0.1:10006';

/** External links shown in operator sidebar (open in new tab). */
export const OPERATOR_EXTERNAL_LINKS = [
  {
    label: 'Local AI hub',
    description: 'Worker status & all URLs',
    href: `${LOCAL_TEST_URL}/local-ai`,
  },
  {
    label: 'Corpus & cards',
    description: 'Ingest sources (webapp)',
    href: `${LOCAL_TEST_URL}/cards`,
  },
  {
    label: 'Play / surveys',
    description: 'Participant flow preview',
    href: `${LOCAL_TEST_URL}/play`,
  },
  {
    label: 'Rankings',
    description: 'Global rankings preview',
    href: `${LOCAL_TEST_URL}/rankings`,
  },
  {
    label: 'Public site',
    description: 'Production website',
    href: PUBLIC_SITE_URL,
  },
];

export const NAV_SECTIONS = [
  {
    title: 'Get started',
    tabs: [
      {
        id: 'dashboard',
        label: 'Home',
        description: 'Set up your first survey',
      },
      {
        id: 'organizations',
        label: 'Your organisation',
        description: 'Name the group running the survey',
      },
      {
        id: 'survey',
        label: 'Share survey',
        description: 'Password for participants',
      },
    ],
  },
  {
    title: 'Advanced',
    tabs: [
      {
        id: 'cards',
        label: 'Survey cards',
        description: 'Edit cards and decks',
      },
      {
        id: 'intelligence',
        label: 'AI assistant',
        description: 'Generate content with AI',
      },
    ],
  },
];

export function slugifyOrganisationName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
