import { useRouter } from 'next/router';
import { PublicShell as GdsPublicShell } from '@doneisbetter/gds-core/server';
import { getPublicShellProps } from '../../lib/ui/publicChrome';

export function PublicShell({ children, containerSize = 'sm' }) {
  const router = useRouter();
  const activeNavId =
    router.pathname === '/privacy'
      ? 'privacy'
      : router.pathname === '/terms'
        ? 'terms'
        : router.pathname === '/cookies'
          ? 'cookies'
          : 'home';

  return (
    <GdsPublicShell {...getPublicShellProps(activeNavId, { containerSize })}>{children}</GdsPublicShell>
  );
}
