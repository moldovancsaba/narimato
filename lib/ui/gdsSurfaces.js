import { resolveAccentPanelStyles } from '@doneisbetter/gds-core/server';

/**
 * GDS 2.4.3 AccentPanel tokens — light/dark-safe accent surfaces.
 * @see https://github.com/sovereignsquad/general-design-system
 */
export function gdsAccentPanelStyle(tone = 'violet', variant = 'subtle') {
  return resolveAccentPanelStyles(tone, variant);
}

/** Background color strings for legacy `backgroundColor:` inline styles */
export const gdsAccentSurface = {
  violet: gdsAccentPanelStyle('violet').backgroundColor,
  green: gdsAccentPanelStyle('green').backgroundColor,
  gray: gdsAccentPanelStyle('gray').backgroundColor,
  red: gdsAccentPanelStyle('red').backgroundColor,
  amber: gdsAccentPanelStyle('amber').backgroundColor,
  blue: gdsAccentPanelStyle('blue').backgroundColor,
};

/** Full panel style objects (background, border, color) for Paper/Box */
export const gdsAccentPanel = {
  violet: gdsAccentPanelStyle('violet'),
  green: gdsAccentPanelStyle('green'),
  gray: gdsAccentPanelStyle('gray'),
  red: gdsAccentPanelStyle('red'),
  default: gdsAccentPanelStyle('violet'),
};
