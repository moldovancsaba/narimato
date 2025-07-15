# Release Notes

## [v1.1.0] — 2025-07-15T12:37:42Z

### Added
- Enhanced Card component with:
  - Support for both image and text types
  - Consistent aspect ratios (3:4 for text, original for images)
  - Container-based styling system
  - Hashtag support
  - Translation support for text cards

- Created Card-related pages:
  - Individual card view (`/card/[slug]`)
  - Card creation/editing interface
  - Card list view with filters (search, type, hashtags)

- Implemented MongoDB schema:
  - Card model with all required fields
  - Translation support for text cards
  - Hashtag system integration
  - Soft deletion capability

- Added ImgBB integration:
  - Secure image upload handling
  - File type validation
  - Size restrictions (32MB limit)
  - Supported formats: JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF

### Changed
- Updated Card component to follow strict container-based styling
- Improved responsive design with mobile-first approach
- Enhanced component documentation
- Streamlined MongoDB schema with proper indexing

### Technical Details
- Added Zod schema validation for card data
- Implemented pagination for card listing
- Added proper error handling for image uploads
- Enhanced MongoDB query optimization

## [v1.0.0] — 2024-01-08

Initial release of the Narimato application with core functionality:

### Added
- Project documentation structure with standardized markdown files
- Next.js application setup with TypeScript and Tailwind CSS
- MongoDB connection and data models for card management
- Base component system including:
  - Card components
  - Card container
  - Swipe controller
  - UI primitives
- Environment configuration system
