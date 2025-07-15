import { ReactNode, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { typography } from '../../styles/typography'

// Function to calculate contrast ratio
const calculateContrastRatio = (background: string): 'light' | 'dark' => {
  const rgb = background.match(/\d+/g);
  if (!rgb) return 'dark';
  
  const [r, g, b] = rgb.map(x => parseInt(x) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? 'dark' : 'light';
};

// Utility hook for handling adaptive text color
const useAdaptiveTextColor = (ref: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!ref.current) return;

    const updateTextColor = () => {
      const element = ref.current;
      if (!element) return;

      // Get the background color of the parent element
      const parentBg = window.getComputedStyle(element.parentElement || document.body).backgroundColor;
      const contrast = calculateContrastRatio(parentBg);

      // Update the adaptive text color CSS variable
      document.documentElement.style.setProperty(
        '--adaptive-text',
        contrast === 'dark' ? '#171717' : '#ffffff'
      );
    };

    // Set initial color
    updateTextColor();

    // Create an observer to watch for background color changes
    const observer = new MutationObserver(updateTextColor);
    if (ref.current.parentElement) {
      observer.observe(ref.current.parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    // Clean up observer on unmount
    return () => observer.disconnect();
  }, []);
}

type TextProps = {
  children: ReactNode
  className?: string
}

// Common styles for adaptive text
const adaptiveTextStyles = {
  mixBlendMode: 'difference' as const,
  color: 'var(--adaptive-text)',
};

export function H1({ children, className }: TextProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <h1
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLHeadingElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <h2
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLHeadingElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <h3
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLParagraphElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <p
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLParagraphElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <p
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLParagraphElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <p
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLParagraphElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <p
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
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
  const ref = useRef<HTMLLabelElement>(null);
  useAdaptiveTextColor(ref);
  return (
    <label
      ref={ref}
      style={adaptiveTextStyles}
      className={clsx(
      'text-sm',
      'font-medium tracking-normal leading-normal',
      'text-foreground',
      className
    )}>
      {children}
    </label>
  )
}
