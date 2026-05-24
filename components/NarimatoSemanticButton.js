import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import { GdsVocabulary, SemanticButton } from '@gds/core';

function fallbackLabel(action) {
  const config = GdsVocabulary[action];
  return config?.defaultMessage || String(action);
}

/**
 * GDS SemanticButton with SSR-safe fallback for Next.js static prerender.
 * Operator bundle (client-only) hydrates to full semantic labels/icons immediately.
 */
export function NarimatoSemanticButton({ action, ...props }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    const { feedbackState, feedbackText, leftSection, ...buttonProps } = props;
    return <Button {...buttonProps}>{fallbackLabel(action)}</Button>;
  }

  return <SemanticButton action={action} {...props} />;
}
