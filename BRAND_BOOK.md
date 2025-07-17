# Narimato Design System

Last Updated: 2025-07-17T01:00:54Z

## Brand Identity

### Core Values
- Professional and trustworthy
- Modern and intuitive
- Accessible and inclusive
- Dynamic and responsive

### Color Palette

#### Primary Colors
```css
--primary: #0070f3;     /* Primary action color */
--secondary: #6b7280;   /* Secondary elements */
--accent: #3b82f6;      /* Accent highlights */
```

#### System Colors
```css
--success: #10b981;     /* Success states */
--error: #ef4444;       /* Error states */
```

#### Background Colors
```css
--background: #ffffff;   /* Main background (Light) */
--foreground: #171717;  /* Main text (Light) */
--card-background: #f5f5f5;  /* Card background (Light) */
--card-foreground: #171717;  /* Card text (Light) */
--card-border: #e5e5e5;      /* Card borders (Light) */

/* Dark Mode */
--background: #0a0a0a;   /* Main background (Dark) */
--foreground: #ffffff;   /* Main text (Dark) */
--card-background: #171717;  /* Card background (Dark) */
--card-foreground: #ffffff;  /* Card text (Dark) */
--card-border: #262626;      /* Card borders (Dark) */
```

#### Gradients
```css
/* Primary Background Gradient */
--bg-gradient-from: #020024;
--bg-gradient-middle: rgba(9, 9, 121, 1);
--bg-gradient-to: rgba(0, 212, 255, 1);

/* Alternative Gradients */
--gradient-primary-from: #e0f2fe;
--gradient-primary-to: #bae6fd;
--gradient-secondary-from: #f3f4f6;
--gradient-secondary-to: #e5e7eb;
```

### Typography

#### Font Families
- Primary Font: Inter
- Monospace: JetBrains Mono

#### Font Sizes
```css
/* Base Text Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

#### Line Heights
```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

### Spacing System

#### Margins and Padding
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### Border Radius
```css
--border-radius: 0.5rem;  /* 8px */
--radius-sm: 0.25rem;    /* 4px */
--radius-lg: 1rem;       /* 16px */
--radius-full: 9999px;   /* Circular */
```

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

## Component Library

### Cards

#### Base Card
```css
.card {
  @apply rounded-lg border border-[var(--card-border)] bg-[var(--card-background)] p-4 transition-colors;
}
```

#### Text Card
```css
.text-card {
  @apply aspect-[3/4] flex items-center justify-center p-6 text-center;
}
```

#### Image Card
```css
.image-card img {
  @apply w-full h-full object-contain;
}
```

### Buttons

#### Primary Button
```css
.btn-primary {
  @apply bg-[var(--primary)] text-white hover:bg-opacity-90;
  @apply px-4 py-2 rounded-[var(--border-radius)];
  @apply transition-colors duration-200;
  @apply focus:outline-none focus:ring-2;
  @apply text-sm font-semibold tracking-wide;
}
```

#### Secondary Button
```css
.btn-secondary {
  @apply bg-[var(--secondary)] text-white hover:bg-opacity-90;
  /* Same base styles as primary */
}
```

### Form Elements

#### Input Fields
```css
.form-input {
  @apply w-full px-3 py-2;
  @apply rounded-[var(--border-radius)];
  @apply border border-[var(--card-border)];
  @apply bg-[var(--card-background)];
  @apply text-sm font-normal tracking-normal;
  @apply focus:outline-none focus:ring-2 focus:ring-[var(--primary)];
}
```

#### Labels
```css
.form-label {
  @apply block mb-1;
  @apply text-sm font-medium tracking-normal;
  @apply text-foreground;
}
```

## Animation Guidelines

### Transitions
- Default Duration: 200ms
- Easing: ease-in-out
- Color transitions: 300ms
- Transform transitions: 150ms

### Interactive States
- Hover: opacity-90
- Focus: ring-2 ring-primary
- Active: transform scale(0.98)
- Disabled: opacity-50

## Responsive Design

### Breakpoints
```css
--screen-sm: 640px;
--screen-md: 768px;
--screen-lg: 1024px;
--screen-xl: 1280px;
--screen-2xl: 1536px;
```

### Container Widths
```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
```

### Fluid Typography
```css
.text-fluid {
  @apply text-base md:text-lg lg:text-xl;
}
```

## Accessibility

### Color Contrast
- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text
- All interactive elements must have a visible focus state

### Focus States
- All interactive elements must have a visible focus ring
- Focus ring color: var(--primary)
- Focus ring width: 2px
- Focus ring offset: 2px

### Motion
- Respect user's reduced motion preferences
- Provide alternatives for motion-based interactions
- Keep animations subtle and purposeful

## Usage Guidelines

### Dark Mode
- Use semantic color variables
- Test all components in both light and dark modes
- Ensure sufficient contrast in both modes
- Smooth transition between modes

### Best Practices
1. Always use CSS variables for theme values
2. Maintain consistent spacing using the spacing system
3. Use semantic class names
4. Keep animations subtle and performant
5. Test across different viewports
6. Ensure keyboard navigation works
7. Maintain consistent interactive states
