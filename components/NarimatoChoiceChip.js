import Link from 'next/link';
import { Badge } from '@mantine/core';

/**
 * Neutral filter / mode chip (no Mantine color=). Use for org/deck toggles and play mode links.
 */
export function NarimatoChoiceChip({
  label,
  active = false,
  href,
  onClick,
  size = 'sm',
  component,
  ...rest
}) {
  const variant = active ? 'filled' : 'light';
  const shared = {
    variant,
    size,
    style: { cursor: href || onClick ? 'pointer' : undefined },
    children: label,
    ...rest,
  };

  if (href) {
    return <Badge component={component || Link} href={href} {...shared} />;
  }

  return <Badge onClick={onClick} {...shared} />;
}
