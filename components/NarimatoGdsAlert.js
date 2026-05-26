import { StateBlock } from '@doneisbetter/gds-core/client';

const COLOR_TO_VARIANT = {
  blue: 'info',
  yellow: 'info',
  orange: 'info',
  violet: 'info',
  green: 'success',
  red: 'error',
  dark: 'info',
};

/**
 * GDS StateBlock wrapper (replaces Mantine Alert with color=).
 */
export function NarimatoGdsAlert({
  color = 'info',
  title,
  children,
  description,
  compact = true,
  action,
}) {
  const variant = COLOR_TO_VARIANT[color] || color;
  const desc =
    description ||
    (typeof children === 'string' ? children : undefined);

  return (
    <StateBlock
      variant={variant}
      title={title}
      description={desc}
      compact={compact}
      action={action}
    />
  );
}
