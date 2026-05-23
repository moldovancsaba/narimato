import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { BadgeProps } from '@mantine/core';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
interface StatusBadgeProps extends Omit<BadgeProps, 'color'> {
    status: StatusVariant;
    children: React.ReactNode;
}
/**
 * StatusBadge enforces strict semantic coloring.
 * Arbitrary hex colors are prohibited.
 */
declare function StatusBadge({ status, children, ...props }: StatusBadgeProps): react_jsx_runtime.JSX.Element;

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
}
/**
 * Standardized EmptyState component.
 */
declare function EmptyState({ icon, title, description, action }: EmptyStateProps): react_jsx_runtime.JSX.Element;

interface ConfirmDialogProps {
    opened: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    loading?: boolean;
}
/**
 * Standardized destructive/confirmation dialog.
 */
declare function ConfirmDialog({ opened, onClose, onConfirm, title, children, confirmLabel, cancelLabel, isDanger, loading, }: ConfirmDialogProps): react_jsx_runtime.JSX.Element;

export { ConfirmDialog, type ConfirmDialogProps, EmptyState, type EmptyStateProps, StatusBadge, type StatusBadgeProps, type StatusVariant };
