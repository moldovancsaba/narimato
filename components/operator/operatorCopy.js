/** Plain-language labels for the local setup UI. */

export const LOCAL_TEST_URL = 'http://localhost:3000';
export const PUBLIC_SITE_URL = 'https://www.narimato.com';

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
