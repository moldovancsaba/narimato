import dynamic from 'next/dynamic';

/** GDS theme toggle (client-only — uses Mantine color scheme). */
export const NarimatoThemeToggle = dynamic(
  () => import('@doneisbetter/gds-core/client').then((mod) => mod.ThemeToggle),
  { ssr: false }
);
