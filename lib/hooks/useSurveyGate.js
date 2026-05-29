import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { showErrorNotification, showSuccessNotification, showWarningNotification, showInfoNotification } from '../ui/notifications';

/**
 * Redirects to home when an org requires a survey password and the session cookie is missing.
 */
export function useSurveyGate(organizationId) {
  const router = useRouter();

  useEffect(() => {
    if (!organizationId) return;

    (async () => {
      try {
        const res = await fetch(`/api/survey/check?organizationId=${organizationId}`);
        const data = await res.json();
        if (data.required && !data.unlocked) {
          showWarningNotification('Enter your survey password on the home page to continue',
          );
          router.replace('/?locked=1');
        }
      } catch {
        /* fail open */
      }
    })();
  }, [organizationId, router]);
}
