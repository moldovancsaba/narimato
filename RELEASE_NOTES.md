# Release Notes

## [v2.0.0] — 2025-07-15T16:41:57Z

### Added
- Global navigation system implemented across all pages
- New Navigation component with:
  - Responsive design for all screen sizes
  - Active state indicators
  - Dark mode support
  - Consistent styling with the application theme
- Unified navigation structure for improved user experience
- Easy access to all major application features:
  - Home
  - Cards (listing and creation)
  - Dashboard
  - Leaderboard
  - Swipe
  - Vote

### Changed
- Application layout structure to accommodate global navigation
- Root layout enhanced with proper navigation integration
- Improved overall application navigation flow

## [v1.1.1] — 2025-07-15T15:50:42.000Z

### Fixed
- Fixed build errors in Card.tsx and CardList.tsx components
- Fixed React hook dependency arrays in Card component
- Improved JSX structure and syntax
- Removed invalid role prop from CardContainer usage

## [v1.1.0] — 2025-07-15T14:30:43.000Z

### Added
- Enhanced voting system with real-time updates
- User authentication improvements
- Project creation and editing interface
- Performance optimizations

### Fixed
- Dependency conflicts resolution (React version compatibility)
- Package-lock.json regeneration for build stability

## [v1.0.0] — 2024-01-08T00:00:00.000Z

### Added
- Project documentation structure with standardized markdown files
- Next.js application setup with TypeScript and Tailwind CSS
- MongoDB connection and data models for card management
- Enhanced Card component with:
  - Support for both image and text types
  - Consistent aspect ratios (3:4 for text, original for images)
  - Container-based styling system
  - Hashtag support
  - Translation support for text cards

- Card-related pages and functionality:
  - Individual card view (`/card/[slug]`)
  - Card creation/editing interface
  - Card list view with filters (search, type, hashtags)
  - Base component system including:
    - Card components
    - Card container
    - Swipe controller
    - UI primitives

- MongoDB Implementation:
  - Card model with all required fields
  - Translation support for text cards
  - Hashtag system integration
  - Soft deletion capability
  - Optimized schema with proper indexing

- ImgBB Integration:
  - Secure image upload handling
  - File type validation
  - Size restrictions (32MB limit)
  - Supported formats: JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF

### Technical Features
- Environment configuration system
- Zod schema validation for data integrity
- Pagination for efficient data handling
- Comprehensive error handling
- Mobile-first responsive design
- Container-based styling system
