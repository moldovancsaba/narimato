import { grantAnalyticsConsent, revokeAnalyticsConsent } from './analytics/ga';

export const COOKIE_CONSENT_KEY = 'narimato-cookie-consent';

export const CONSENT = {
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export function getConsent() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(COOKIE_CONSENT_KEY);
}

export function setConsent(value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COOKIE_CONSENT_KEY, value);
}

export function applyConsent(value) {
  if (value === CONSENT.ACCEPTED) grantAnalyticsConsent();
  else revokeAnalyticsConsent();
}

export function syncConsentFromStorage() {
  applyConsent(getConsent());
}
