import { ReactNode } from 'react'
import clsx from 'clsx'
import { typography } from '../../styles/typography'

type TextProps = {
  children: ReactNode
  className?: string
}

export function H1({ children, className }: TextProps) {
  return (
    <h1 className={clsx(
      'text-4xl md:text-5xl lg:text-6xl',
      'font-bold tracking-tight leading-tight',
      'text-foreground',
      className
    )}>
      {children}
    </h1>
  )
}

export function H2({ children, className }: TextProps) {
  return (
    <h2 className={clsx(
      'text-3xl md:text-4xl',
      'font-bold tracking-tight leading-tight',
      'text-foreground',
      className
    )}>
      {children}
    </h2>
  )
}

export function H3({ children, className }: TextProps) {
  return (
    <h3 className={clsx(
      'text-2xl md:text-3xl',
      'font-semibold tracking-tight leading-snug',
      'text-foreground',
      className
    )}>
      {children}
    </h3>
  )
}

export function Body({ children, className }: TextProps) {
  return (
    <p className={clsx(
      'text-base md:text-lg',
      'font-normal tracking-normal leading-relaxed',
      'text-foreground',
      className
    )}>
      {children}
    </p>
  )
}

export function SmallText({ children, className }: TextProps) {
  return (
    <p className={clsx(
      'text-sm md:text-base',
      'font-normal tracking-normal leading-normal',
      'text-foreground',
      className
    )}>
      {children}
    </p>
  )
}

export function Caption({ children, className }: TextProps) {
  return (
    <p className={clsx(
      'text-xs',
      'font-normal tracking-normal leading-normal',
      'text-foreground/80',
      className
    )}>
      {children}
    </p>
  )
}

export function ErrorText({ children, className }: TextProps) {
  return (
    <p className={clsx(
      'text-sm',
      'font-medium tracking-normal leading-normal',
      'text-error',
      className
    )}>
      {children}
    </p>
  )
}

export function InputLabel({ children, className }: TextProps) {
  return (
    <label className={clsx(
      'text-sm',
      'font-medium tracking-normal leading-normal',
      'text-foreground',
      className
    )}>
      {children}
    </label>
  )
}
