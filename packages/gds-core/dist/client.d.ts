import { SemanticAction } from './server.js';
export { AccentPanel, AccentPanelProps, AccentPanelVariant, AccentTone, AccessSummary, AccessSummaryProps, ArticleShell, ArticleShellProps, AuthShell, AuthShellProps, BreadcrumbItem, CtaButtonGroup, CtaButtonGroupProps, DataToolbar, DataToolbarFilterChip, DataToolbarProps, DocsPageShell, DocsPageShellProps, EditorialHero, EditorialHeroAction, EditorialHeroMetaItem, EditorialHeroProps, EmptyState, EmptyStateProps, FeatureBand, FeatureBandItem, FeatureBandProps, FilterDrawer, FilterDrawerProps, FormField, FormFieldProps, GdsIcons, GdsLocale, GdsVocabulary, MediaCard, MediaCardAction, MediaCardProps, MetricCard, MetricCardProps, PageHeader, PageHeaderEyebrowVariant, PageHeaderProps, PlaceholderPanel, PlaceholderPanelProps, ProductCard, ProductCardAction, ProductCardMetaItem, ProductCardProps, ProgressCard, ProgressCardProps, PublicBrandFooter, PublicBrandFooterProps, PublicNav, PublicNavItem, PublicNavProps, PublicProductCard, PublicProductCardMetaItem, PublicProductCardProps, PublicProductCardState, PublicShell, PublicShellProps, PublicSiteFooter, PublicSiteFooterProps, SimpleDataTable, SimpleDataTableProps, SimpleTableColumn, StateBlock, StateBlockProps, StateBlockVariant, StatsSection, StatsSectionProps, StatusBadge, StatusBadgeProps, StatusVariant, ar, de, en, es, fr, gdsLocales, getGdsMessages, he, hu, it, resolveAccentPanelStyles, ru } from './server.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import react__default, { ReactNode } from 'react';
import { ButtonProps, MantineColor } from '@mantine/core';
import '@tabler/icons-react';

interface ConfirmDialogProps {
    opened: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: ReactNode;
    confirmAction?: SemanticAction;
    cancelAction?: SemanticAction;
    isDanger?: boolean;
    loading?: boolean;
}
/**
 * Standardized destructive/confirmation dialog.
 */
declare function ConfirmDialog({ opened, onClose, onConfirm, title, children, confirmAction, cancelAction, isDanger, loading, }: ConfirmDialogProps): react_jsx_runtime.JSX.Element;

interface ThemeToggleProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
}
/**
 * Standardized ThemeToggle component for switching between Light and Dark mode.
 * Should be placed in the main application header/shell.
 */
declare function ThemeToggle({ size }: ThemeToggleProps): react_jsx_runtime.JSX.Element;

interface SemanticButtonProps extends ButtonProps, Omit<react__default.ComponentPropsWithoutRef<'button'>, keyof ButtonProps | 'leftSection' | 'children'> {
    action: SemanticAction;
    loading?: boolean;
    feedbackState?: 'success' | 'error' | null;
    feedbackText?: string;
}
/**
 * SemanticButton strictly enforces ubiquitous language and standardized iconography.
 * Developers cannot pass arbitrary text or icons; they must use a semantic action key.
 */
declare function SemanticButton({ action, loading, feedbackState, feedbackText, ...props }: SemanticButtonProps): react_jsx_runtime.JSX.Element;

interface GameBoardTileProps {
    face: ReactNode;
    revealed: boolean;
    matched: boolean;
    disabled: boolean;
    onPress: () => void;
    /** Mantine color token for revealed (non-matched) highlight, e.g. `violet.5` or product primary. */
    highlightColor?: MantineColor;
}
/**
 * Governed flip/select tile for memory-match and similar game boards.
 * Respects prefers-reduced-motion; motion is local to the tile, not global theme hover defaults.
 */
declare function GameBoardTile({ face, revealed, matched, disabled, onPress, highlightColor, }: GameBoardTileProps): react_jsx_runtime.JSX.Element;

interface DocsCodeBlockProps {
    code: string;
    language?: string;
    title?: string;
    withCopy?: boolean;
}
declare function DocsCodeBlock({ code, language, title, withCopy }: DocsCodeBlockProps): react_jsx_runtime.JSX.Element;

interface UploadDropzoneProps {
    title: string;
    description?: string;
    onFilesSelected?: (files: File[]) => void;
    accept?: string;
    multiple?: boolean;
    actionLabel?: string;
    mode?: 'panel' | 'inline';
}
declare function UploadDropzone({ title, description, onFilesSelected, accept, multiple, actionLabel, mode, }: UploadDropzoneProps): react_jsx_runtime.JSX.Element;

type AccessRecoveryState = 'unauthenticated' | 'expired-session' | 'forbidden' | 'missing' | 'unavailable';
interface AccessRecoveryAction {
    action: SemanticAction;
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
    color?: string;
    variant?: 'filled' | 'light' | 'outline' | 'subtle' | 'default';
}
interface AccessRecoveryPanelProps {
    state: AccessRecoveryState;
    title?: string;
    description?: ReactNode;
    primaryAction?: AccessRecoveryAction | null;
    secondaryAction?: AccessRecoveryAction | null;
    tertiaryAction?: AccessRecoveryAction | null;
    onRetry?: () => void;
    onSignIn?: () => void;
    onBack?: () => void;
    supportAction?: AccessRecoveryAction | null;
    compact?: boolean;
}
declare function AccessRecoveryPanel({ state, title, description, primaryAction, secondaryAction, tertiaryAction, onRetry, onSignIn, onBack, supportAction, compact, }: AccessRecoveryPanelProps): react_jsx_runtime.JSX.Element;

export { type AccessRecoveryAction, AccessRecoveryPanel, type AccessRecoveryPanelProps, type AccessRecoveryState, ConfirmDialog, type ConfirmDialogProps, DocsCodeBlock, type DocsCodeBlockProps, GameBoardTile, type GameBoardTileProps, SemanticAction, SemanticButton, type SemanticButtonProps, ThemeToggle, type ThemeToggleProps, UploadDropzone, type UploadDropzoneProps };
