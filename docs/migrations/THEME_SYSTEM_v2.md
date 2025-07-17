# Theme System Migration Guide v2

## Overview

This update introduces major changes to the theme system to better align with narimato.md and BRAND_BOOK.md specifications. The changes ensure proper aspect ratios, prevent overlapping cards, and implement a true mobile-first responsive design.

## Breaking Changes

### 1. Component Styles

All component styles have been moved from individual components to `globals.css`. This ensures:
- Consistent styling across components
- Better maintainability
- Proper Tailwind layer usage

### 2. Card System

Cards now use data attributes for variants and types:

```tsx
// Before
<div className="card card-interactive">...</div>

// After
<div className="card" data-variant="interactive">...</div>
```

#### Text Cards
- Fixed 3:4 aspect ratio is now enforced
- Content automatically scales to fit
```tsx
<div className="card-grid-item" data-type="text">
  <div className="card">...</div>
</div>
```

#### Image Cards
- Native aspect ratio is preserved
- Uses `object-contain` for proper scaling
```tsx
<div className="card-grid-item" data-type="image">
  <div className="card">
    <img className="object-contain" />
  </div>
</div>
```

### 3. Theme Configuration

The theme configuration has been restructured:
- CSS variables moved to `theme.css`
- Component styles moved to `globals.css`
- New utility classes added for layouts

## Migration Steps

1. Update Component References:
```tsx
// Find and replace all direct classNames
- className="card-interactive"
+ className="card" data-variant="interactive"

- className="card-text"
+ className="card-grid-item" data-type="text"

- className="card-image"
+ className="card-grid-item" data-type="image"
```

2. Update Grid Layouts:
```tsx
// Replace custom grid implementations with card-grid
- <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
+ <div className="card-grid">
```

3. Update Container Usage:
```tsx
// Use new container classes
- <div className="max-w-7xl mx-auto px-4">
+ <div className="container">
```

4. Update Breakpoint Usage:
```tsx
// Use standardized breakpoints
- @media (min-width: 768px)
+ @apply sm:... md:... lg:... xl:...
```

## New Features

### 1. Layout Utilities

New utility classes for common layouts:
```tsx
// Centered flex container
<div className="flex-center">

// Space-between flex container
<div className="flex-between">

// Auto-fit grid
<div className="grid-auto-fit">
```

### 2. Dark Mode

Dark mode now properly follows system preferences and can be toggled:
```tsx
// Dark mode styles are automatically applied
// No manual className="dark" needed
```

### 3. Animation Utilities

New animation classes:
```tsx
<div className="animate-fade">
<div className="animate-scale">
<div className="animate-slide-up">
<div className="animate-slide-down">
```

## Best Practices

1. Always wrap cards in `card-grid-item` for proper sizing
2. Use data attributes for variants instead of classes
3. Follow mobile-first approach with responsive utilities
4. Use container classes for consistent spacing
5. Leverage new animation utilities for transitions

## Testing

Key areas to test after migration:
1. Card aspect ratios in different containers
2. Grid layouts at all breakpoints
3. Dark mode functionality
4. Image scaling and containment
5. Animation performance
6. Container responsiveness

## Support

If you encounter any issues during migration:
1. Check the component documentation
2. Verify data-attributes are properly set
3. Ensure proper nesting of card components
4. Validate breakpoint usage follows mobile-first approach
