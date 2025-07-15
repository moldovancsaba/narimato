# Release Notes

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
