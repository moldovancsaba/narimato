# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

NARIMATO is an anonymous, session-based card ranking application built with Next.js 15.4.4, MongoDB, JavaScript, and sophisticated binary search ranking algorithms. It's architected as a multi-tenant system with organization-level customization and ELO-based global rankings.

**Current Version:** 6.0.0 (Documentation Synchronization & Version Consistency)

## Essential Development Commands

### Core Development
```bash
# Start development server (increment PATCH version first per rules)
npm run dev

# Build production bundle (verify successful build before committing)
npm run build

# Start production server
npm run start

# Lint codebase
npm run lint
```

### Database Management
```bash
# Initialize master database with organization schema
node scripts/init-master-db.js

# Setup organization-specific databases
node scripts/setup-databases.js

# Create default organization
node scripts/create-default-org.js
node scripts/init-default-org.js

# Database cleanup and migration utilities
node scripts/cleanup-database.js
node scripts/cleanup-obsolete-data.js
node scripts/migrate-name-to-displayname.js
node scripts/add-cardsize-to-cards.js

# Organization management utilities
node scripts/recreate-organization.js
node scripts/delete-default-org.js
```

### Key Deployment Notes
- **Before `npm run dev`**: Increment PATCH version in package.json (+1)
- **Before commit**: Increment MINOR version, reset PATCH to 0
- **Before production deploy**: Verify build passes and documentation is updated

## Project Architecture

### Directory Structure

```
/pages                        # Next.js Pages Router
├── api/                     # API route handlers
│   └── v1/                  # Versioned API endpoints (play)
├── _app.js                  # App wrapper (Pages Router)
├── _document.js             # Document with global CSS links
├── index.js                 # Home page
├── play.js                  # Play UI
├── results.js               # Results UI
├── rankings.js              # Rankings UI
├── organizations.js         # Organization management UI

/lib                         # Core application logic
├── constants/               # Centralized constants (CRITICAL)
│   └── fieldNames.js        # Field name standardization (actual mappings)
├── models/                  # Mongoose schemas
├── services/                # Business logic services
├── middleware/              # Middleware utilities (e.g., rate limiting)
├── utils/                   # Utility functions
└── validation/              # Input validation schemas

/scripts                     # Database management and setup scripts
/docs                        # Technical documentation
/public/styles               # CSS files (buttons.css, cards.css, game.css)
```

### Critical Architectural Patterns

#### 1. UUID-First Field Standardization
**MANDATORY**: All UUID fields are accessed via centralized constants in `/lib/constants/fieldNames.js` (do not hardcode field names):
- `OrganizationUUID`: Organization identifiers
- `SessionUUID`: Session identifiers  
- `PlayUUID`: Play session identifiers
- `CardUUID`: Card identifiers
- `DeckUUID`: Deck identifiers

**Never use**: `sessionId`, `cardId`, `uuid`, or any other variations. Always import and use field constants.

#### 2. Multi-Tenant Database Architecture
- **Master Database**: Contains Organization metadata only
- **Per-Organization Databases**: Separate MongoDB databases for each organization's data
- **Connection Management**: Database connections are managed per-organization via `buildOrgMongoUri()`
- **Security**: Only MongoDB Atlas connections allowed (localhost prohibited)

#### 3. Organization-Level Theme Management (v4.1.0+)
- Centralized theming system with CSS injection
- Animated background support via `backgroundCSS` field
- Google Fonts integration via `googleFontURL`
- Emoji and icon management with validation
- Live preview system in organization editor

#### 4. Play-Based Session Architecture
- **Modern**: Play model for session management
- **Legacy**: Session model (deprecated but still present)
- **Ranking**: Binary search algorithm with O(log n) complexity
- **Global Rankings**: ELO-based rating system

#### 5. Vote Integrity & Caching System (v4.4.0+)
- **Double Vote Prevention**: Dual-layer protection with client-side debouncing (100ms) and server-side deduplication (2-second window)
- **Organization Caching**: Global cache with 5-minute TTL and concurrent request deduplication
- **Memory Management**: Automatic cache cleanup and intelligent invalidation
- **Performance Optimization**: 80% reduction in redundant API calls

### Key Files and Their Purpose

- `/lib/constants/fieldNames.js` - CRITICAL: Field name centralization (OrganizationUUID → organizationId; most UUIDs → uuid; DeckUUID → deckTag)
- `/lib/db.js` - Database connection utilities (if present)
- `/lib/models/Organization.js` - Organization schema
- `/lib/services/play/PlayDispatcher.js` - Central dispatcher for all play modes (vote_only, swipe_only, swipe_more, vote_more)
- `/lib/middleware/rateLimit.js` - Rate limiting middleware
- `next.config.js` - Next.js configuration and security headers

## Development Workflow & Protocols

### Mandatory Version Management
Per the versioning rules, you **MUST**:

1. **Before running `npm run dev`**: 
   - Increment PATCH version (+1)
   - Example: 4.1.5 → 4.1.6

2. **Before committing to GitHub**:
   - Increment MINOR version (+1), reset PATCH to 0
   - Example: 4.1.6 → 4.2.0
   - Update ALL documentation files with new version

3. **For major releases** (when explicitly instructed):
   - Increment MAJOR version (+1), reset MINOR and PATCH to 0
   - Example: 4.2.0 → 5.0.0

### Documentation Update Protocol
When making changes, you **MUST** update these files:
- `README.md` - Feature descriptions and version badges
- `ARCHITECTURE.md` - Technical changes and system overview
- `TASKLIST.md` - Task status and new items
- `LEARNINGS.md` - Insights and lessons learned  
- `RELEASE_NOTES.md` - Version changelog
- `ROADMAP.md` - Impact on future plans (forward-looking only)

### Code Comment Requirements
All code must include comments explaining:
1. **Functional Explanation** - What does this code accomplish?
2. **Strategic Justification** - Why was this approach chosen in the system context?

Example:
```typescript
// FUNCTIONAL: Creates organization-specific database connections with pooling
// STRATEGIC: Multi-tenant isolation requires separate DB instances per organization
export function createOrgDbConnect(organizationId: string) { ... }
```

### Reuse Before Creation Rule
**MANDATORY**: Before creating any new file, module, component, or function:
1. Search existing codebase for reusable elements
2. Evaluate fitness for reuse or extension
3. Document why no reusable option was applicable if creating new

## Environment Management

### Required Environment Variables
```bash
# .env.local (required)
MONGODB_URI=mongodb+srv://...     # MongoDB Atlas connection
ORGANIZATION_DB_URIS={}           # JSON map of org-specific URIs (optional)
```

### Database Connection Rules
- **Only MongoDB Atlas allowed** (no localhost)
- **Master DB**: Uses `MONGODB_URI` directly
- **Organization DBs**: Generated via `buildOrgMongoUri()` unless specified in `ORGANIZATION_DB_URIS`
- **Connection Security**: All URIs validated for injection prevention

## Critical "Do/Don't" Rules

### ❌ PROHIBITED
- **Tests**: Testing is explicitly prohibited ("MVP Factory, no Tests")
- **Breadcrumbs**: Navigation breadcrumbs are banned across all interfaces
- **Hardcoded Field Names**: Always use constants from `fieldNames.js`
- **Outdated Documentation**: Never leave deprecated info in any .md file
- **Localhost MongoDB**: Only Atlas connections allowed
- **Non-Semantic Versioning**: Must follow MAJOR.MINOR.PATCH format

### ✅ MANDATORY
- **ISO 8601 Timestamps**: Format `YYYY-MM-DDTHH:MM:SS.sssZ` for all timestamps
- **Comprehensive Comments**: Both functional and strategic explanations required
- **Field Name Constants**: Import and use `fieldNames.js` constants everywhere
- **Documentation Sync**: Update all relevant .md files when making changes
- **Version Consistency**: Version must match across package.json, UI, and all docs

### Development Best Practices
- **Build Verification**: Always verify `npm run build` passes before commit
- **Manual Testing**: Verify changes in development environment
- **State Management**: Use EventAgent for complex workflow state transitions
- **Security Headers**: Leverage existing middleware for API security
- **Error Handling**: Implement comprehensive error boundaries and recovery

## Stack Compliance

### Core Technologies (DO NOT CHANGE without approval)
- **Runtime**: Node.js 20+
- **Framework**: Next.js 15.4.4 (Pages Router)
- **Database**: MongoDB 7.0+ (Atlas only)
- **Language**: JavaScript
- **Styling**: Custom CSS (public/styles)
- **Animations**: @react-spring/web, @use-gesture/react
- **Validation**: zod

### Before Adding Dependencies
1. Check if existing libraries can accomplish the goal
2. Verify compatibility with current stack
3. Document rationale for new dependency
4. Update `ARCHITECTURE.md` with stack changes

## API Architecture

### Endpoint Structure
- `/api/v1/` - Current API version (Play APIs)
- `/api/` - Cards APIs (non-versioned)
- `/api/system/` - System utilities
- `/api/debug/` - Development debugging

### Critical Endpoints
- `/api/v1/organizations/[slug]` - Organization management
- `/api/v1/play/start` - Play session initialization
- `/api/v1/play/results` - Session results and rankings
- `/api/v1/play/results/[playUUID]` - Individual play session results
- `/api/v1/play/vote-only/*` - Specialized vote-only endpoints (backward compatibility)
- `/api/v1/global-rankings` - ELO-based global rankings
- `/api/cards` - Card list/CRUD operations (Pages Router)
- `/api/cards/[uuid]` - Individual card management
- `/api/v1/session/[sessionUUID]/vote` - Vote submission with deduplication (legacy)
- `/api/v1/admin/organizations` - Organization administration
- `/api/v1/presets/backgrounds` - Theme background presets
- `/api/v1/presets/fonts` - Font presets
- `/api/v1/upload/imgbb` - Image upload service

### Security Middleware
- Rate limiting: 100 requests/minute per IP (see `/lib/middleware/rateLimit.js`)
- CORS headers configured (if applicable via Next.js config)
- Security headers (XSS, CSRF, Frame Options)
- Content-Security-Policy in production

## Troubleshooting Common Issues

### Webpack Cache Corruption
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Database Connection Issues
- Verify `MONGODB_URI` in `.env.local`
- Check Atlas IP whitelist settings
- Ensure connection string format is correct

### Field Name Consistency Errors
- Use ESLint rule `field-naming-consistency` (configured in `.eslintrc.field-names.js`)
- Always import constants from `fieldNames.js`
- Run linting before commits

### Build Failures
- TypeScript errors are ignored during build (MVP mode)
- Verify all imports resolve correctly
- Check for missing environment variables

### Double Voting Issues (Fixed v4.4.0)
- **Problem**: Users could rapidly click vote buttons, causing duplicate submissions
- **Solution**: Implemented dual-layer protection with 100ms client-side debouncing and 2-second server-side deduplication window
- **Detection**: Check for multiple identical votes in console or database
- **Prevention**: Ensure vote submission functions use timestamp checking

### Session Results Not Found (Fixed v4.4.0)
- **Problem**: "No session results found" after completing voting sessions
- **Root Cause**: API response format mismatch between backend structure and frontend expectations
- **Solution**: Transform API response data correctly mapping `sessionInfo.deckTag` and `personalRanking` array
- **Check**: Verify results API returns proper data structure with all required fields

### Organization Loading Issues (Fixed v4.4.0)
- **Problem**: Organization list fails to load on first visit or in incognito mode
- **Root Cause**: React hydration conflicts and race conditions in useEffect hooks
- **Solution**: Implemented 100ms delay in initial data fetch and global caching with 5-minute TTL
- **Check**: Test first load without cached data, verify no hydration mismatches in console

## Documentation References

### Essential Reading (keep these updated)
- [`README.md`](./README.md) - Project overview and features
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Detailed technical architecture
- [`TASKLIST.md`](./TASKLIST.md) - Current development tasks
- [`ROADMAP.md`](./ROADMAP.md) - Strategic development plans
- [`LEARNINGS.md`](./LEARNINGS.md) - Development insights and lessons
- [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) - Version changelog

### Specialized Documentation
- [`UUID.md`](./UUID.md) - UUID implementation details
- [`RANKING_SYSTEM_FIXES.md`](./RANKING_SYSTEM_FIXES.md) - Ranking algorithm improvements
- [`ACCESSIBILITY_COMPLIANCE.md`](./ACCESSIBILITY_COMPLIANCE.md) - Accessibility standards
- [`narimato_unified_documentation_UPDATED.md`](./narimato_unified_documentation_UPDATED.md) - Comprehensive system documentation

### Technical References in /docs/
- `API_REFERENCE.md` - Complete API documentation
- `CARD_EDITOR.md` - Card creation and editing system
- `MULTI_LEVEL_CARD_SYSTEM.md` - Hierarchical card organization

## Maintenance Notes

### Regular Maintenance Tasks
1. **Version Consistency Audit**: Ensure version matches across all files
2. **Documentation Sync**: Keep all .md files current with codebase
3. **Dependency Updates**: Monitor and update dependencies regularly
4. **Database Cleanup**: Use provided scripts for data maintenance

### Future Extensibility Considerations
- Plugin architecture foundation exists for theme extensions
- Multi-tenant design supports scaling to more organizations
- API versioning enables backward compatibility
- Event-driven architecture supports feature additions

### Onboarding New AI Agents
1. Read this WARP.md file completely
2. Review `ARCHITECTURE.md` for technical depth
3. Examine `fieldNames.ts` for naming conventions
4. Study existing API patterns in `/api/v1/`
5. Test environment setup with database scripts

---

**Remember**: This codebase follows strict conventions for maintainability, security, and scalability. When in doubt, follow the patterns established in existing code and always update documentation when making changes.
