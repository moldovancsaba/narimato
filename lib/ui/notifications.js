import { showGdsNotification } from '@doneisbetter/gds-theme/client';

/** Canonical Narimato toast surface — wraps GDS notification contract (not @mantine/notifications). */
export { showGdsNotification };

export const showErrorNotification = (message, title) =>
  showGdsNotification({ tone: 'error', message, title });

export const showSuccessNotification = (message, title) =>
  showGdsNotification({ tone: 'success', message, title });

export const showWarningNotification = (message, title) =>
  showGdsNotification({ tone: 'warning', message, title });

export const showInfoNotification = (message, title) =>
  showGdsNotification({ tone: 'info', message, title });
