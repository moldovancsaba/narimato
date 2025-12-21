# WARP.md — Single Source of Truth

This file provides guidance to WARP (warp.dev) when working with code in this repository.

**Current Version:** 7.1.0  
**Last Updated:** 2025-12-21T21:10:00.000Z  
**Purpose:** Comprehensive AI agent onboarding and project governance

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Essential Development Commands](#essential-development-commands)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Documentation Index](#documentation-index)
5. [Mandatory AI Rules](#mandatory-ai-rules)
6. [Development Workflow](#development-workflow)
7. [Stack & Dependencies](#stack--dependencies)
8. [Critical Patterns](#critical-patterns)
9. [Operational Notes](#operational-notes)

---

## Project Overview

NARIMATO is an anonymous, session-based card ranking application built with Next.js 15.5.3, MongoDB, and ELO-powered global rankings. The system uses a Pages Router API with a Play-centric session model and binary-search-based ranking.

**Current Version:** 7.1.0

### Key Capabilities
- **6 Play Modes**: vote-only, swipe-only, swipe-more, vote-more, rank-only, rank-more
- **Multi-Tenant**: Separate databases per organization with master metadata DB
- **Binary Search Ranking**: O(log n) card positioning algorithm
- **ELO Global Rankings**: Cross-session skill-based card comparisons
- **Hashtag Hierarchy**: Multi-level card organization via parent-child relationships
- **Organization Theming**: Custom backgrounds, fonts, emojis/icons per org

---

## Essential Development Commands

### Core Development
```bash
# ALWAYS increment PATCH before starting dev (per versioning rules)
npm run dev

# Build production bundle (verify before committing)
npm run build

# Start production server
npm run start

# Lint codebase
npm run lint
```

### Database Management
```bash
# Master + org DB setup
node scripts/init-master-db.js
node scripts/setup-databases.js
node scripts/init-default-org.js

# Org admin utilities
node scripts/recreate-organization.js
node scripts/delete-default-org.js
node scripts/seed-superadmin.js

# Migrations / cleanup
node scripts/migrate-name-to-displayname.js
node scripts/add-cardsize-to-cards.js
node scripts/cleanup-database.js
node scripts/cleanup-obsolete-data.js
node scripts/cleanup-default-orgs.js
```

**Note on Testing**: Tests are NOT used in this project (MVP factory approach). There is no test runner. Use debug/diagnostic scripts in repo root (e.g., `node test-hierarchical-api.js`) for targeted checks.

### Environment Variables
```bash
# .env.local (required)
MONGODB_URI=mongodb+srv://...              # MongoDB Atlas connection
ORGANIZATION_DB_URIS={}                    # Optional: JSON map for per-org URIs
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX # Optional: GA4 measurement ID
```

---

## Architecture at a Glance

### Directory Structure
```
/pages                  # Next.js Pages Router
├── _app.js            # App wrapper, GA4 integration
├── _document.js       # HTML document, global CSS
├── index.js           # Home page
├── play.js            # Play UI (all 6 modes)
├── results.js         # Results comparison (personal vs global)
├── rankings.js        # Global rankings view
├── organizations.js   # Org management
├── admin/            # Admin interfaces
└── api/              # API routes
    └── v1/
        └── play/     # Unified Play API

/lib                   # Core application logic
├── constants/
│   └── fieldNames.js  # UUID field name constants (CRITICAL)
├── models/           # Mongoose schemas
├── services/         # Business logic engines
│   ├── decisionTree/ # Binary search ranking
│   ├── VoteOnlyService.js
│   ├── RankMoreEngine.js
│   └── ...
├── middleware/       # Rate limiting, API versioning
├── analytics/        # GA4 integration
├── utils/           # Helper functions
└── validation/      # Zod schemas

/scripts              # Database management scripts
/docs                 # Technical documentation
/public/styles        # CSS files (cards.css, game.css, etc.)
```

### Key Patterns
- **UUID Constants**: Always import from `lib/constants/fieldNames.js` — never hardcode field names
- **Multi-Tenant DB**: Master org metadata + per-org DBs via `buildOrgMongoUri()` in `lib/db.js`
- **Play Modes**: Orchestrated via unified API routes and pluggable service engines
- **Vote Integrity**: Client debounce (100ms) + server dedupe window (2s)
- **Theming**: Organization-level customization (backgroundCSS, googleFontURL, emoji/icon lists)

### Critical Files
- `lib/constants/fieldNames.js` — UUID field names (OrganizationUUID, SessionUUID, PlayUUID, CardUUID, DeckUUID)
- `lib/db.js` — Database connection helpers and org URI building
- `lib/services/decisionTree/BinarySearchEngine.js` — Binary search ranking core
- `lib/middleware/rateLimit.js` — Per-IP rate limiting (100 req/min)
- `lib/analytics/ga.js` — GA4 helpers (production-only)
- `pages/api/v1/play/start.js` — Play session initialization
- `pages/api/v1/play/[playId]/input.js` — Input events (swipe/vote)
- `pages/api/v1/play/[playId]/next.js` — Next prompt
- `pages/api/v1/play/[playId]/results.js` — Results payload

---

## Documentation Index

### 📖 Core Documentation (Essential Reading)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **README.md** | Product overview, features, quick start | First-time orientation, feature reference |
| **ARCHITECTURE.md** | Technical architecture, flow diagrams, algorithms | Deep technical understanding, system design |
| **WARP.md** (this file) | AI agent onboarding, rules, commands | Always — primary reference |

### 📋 Project Governance

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **TASKLIST.md** | Active tasks, priorities, status, owners | Planning work, tracking progress |
| **ROADMAP.md** | Forward-looking development plans (Q4 2025+) | Strategic planning, feature roadmap |
| **RELEASE_NOTES.md** | Version history, changelogs (historical) | Understanding past changes, release tracking |
| **LEARNINGS.md** | Development insights, lessons learned, solutions | Avoiding past mistakes, understanding decisions |

### 🔧 Technical References

| Document | Location | Purpose |
|----------|----------|----------|
| **API_REFERENCE.md** | docs/ | Complete API documentation with examples |
| **UUID.md** | root | UUID-centric architecture standard |
| **CARD_EDITOR.md** | docs/ | Card creation/editing system |
| **MULTI_LEVEL_CARD_SYSTEM.md** | docs/ | Hierarchical card organization |
| **hashtag_hierarchy.md** | docs/ | Hashtag parent-child relationships |
| **aspect_ratio_management.md** | docs/ | Card sizing and aspect ratios |

### 🔍 Specialized Technical Docs

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **DECISION_TREE_REWRITE.md** | Decision tree service architecture | Understanding ranking engine refactor |
| **ERROR_HANDLING_IMPLEMENTATION.md** | Error handling patterns | Implementing error responses |
| **RANKING_SYSTEM_FIXES.md** | Ranking algorithm improvements | Debugging ranking issues |
| **ACCESSIBILITY_COMPLIANCE.md** | WCAG compliance standards | Accessibility work |
| **WORKFLOW_FIXED.md** | Specific workflow fix documentation | Historical context |

### 🚨 Issue Analysis Docs (Historical)

| Document | Purpose | Status |
|----------|---------|--------|
| **CARD_ADDITION_AND_RANKING_FLOW_ANALYSIS.md** | Card flow analysis | Historical reference |
| **CARD_RANKING_SYNC_FAILURE_POINTS.md** | Sync failure analysis | Historical reference |
| **DECISION_TREE_TESTING_GUIDE.md** | Testing guide | Historical (tests prohibited) |
| **ORGANIZATION_ROUTING_AUDIT.md** | Routing audit | Historical reference |
| **CHUNK_ERROR_PREVENTION.md** | Build chunk errors | Historical reference |

### 🤖 AI Conversation Logs

| Document | Purpose |
|----------|----------|
| **WARP.DEV_AI_CONVERSATION.md** | AI agent session history, decisions, plans |
| **narimato_unified_documentation.md** | Archived unified documentation (v6.5.0) |
| **narimato_unified_documentation_ARCHIVED.md** | Legacy documentation archive |

---

## Mandatory AI Rules

### 📜 Documentation & Versioning Protocol

**Source**: AI Rules from project configuration

#### Versioning (CRITICAL)
```
Format: MAJOR.MINOR.PATCH (e.g., 7.1.0)

Before npm run dev:    Increment PATCH (+1)        Example: 7.1.0 → 7.1.1
Before commit:         Increment MINOR (+1),       Example: 7.1.1 → 7.2.0
                       reset PATCH to 0
Major release:         Increment MAJOR (+1),       Example: 7.2.0 → 8.0.0
(explicit only)        reset MINOR and PATCH to 0
```

**Version must be synchronized across:**
- package.json
- All documentation files (README, ARCHITECTURE, TASKLIST, ROADMAP, RELEASE_NOTES, LEARNINGS)
- MongoDB (if versioned data is stored)
- UI display (if applicable)

#### Documentation Update Protocol
**Before EVERY commit, update these files:**
- `README.md` — Feature descriptions and version badges
- `ARCHITECTURE.md` — Technical changes and system overview
- `TASKLIST.md` — Task status and new items
- `LEARNINGS.md` — Insights and lessons learned
- `RELEASE_NOTES.md` — Version changelog with ISO 8601 timestamps
- `ROADMAP.md` — Impact on future plans (forward-looking only)

**Timestamp Format (MANDATORY):**
```
ISO 8601 with milliseconds in UTC: YYYY-MM-DDTHH:MM:SS.sssZ
Example: 2025-12-21T21:10:00.000Z
```

### 📐 Documentation Structure Rules

**Source**: Documentation governance rules

#### README.md
- Overview of the product
- Lists and links to all other documentation
- Contains version badge and quickstart instructions
- Updated when a document is added/removed

#### ROADMAP.md (Forward-Looking ONLY)
- Only future development plans
- NO historical entries allowed
- Group by Quarter/Milestone
- Must include priorities and dependencies

#### TASKLIST.md
- List of active and upcoming tasks
- Sorted by priority
- Each task: title, owner, expected delivery date, status
- Move completed tasks to RELEASE_NOTES.md

#### RELEASE_NOTES.md (Historical ONLY)
- Versioned log of completed tasks
- Include: date, version tag, what changed/fixed/added
- Format: `## [vX.Y.Z] — YYYY-MM-DDTHH:MM:SS.sssZ`

#### ARCHITECTURE.md
- Current system overview only
- NO outdated components or deprecated technologies
- Prefer diagrams and schemas
- Each component documented with: role, dependencies, status

#### LEARNINGS.md
- Only actual issues faced and resolved
- Categorized by: Dev / Design / Backend / Frontend / Process / Other
- Should prevent repeated mistakes

**Prohibited in ALL Docs:**
- Outdated or deprecated elements
- Personal opinions or uncertain notes
- "To be confirmed", "maybe", "soon" placeholders
- Unstructured or uncategorized text blocks

### 🔍 Reuse Before Creation Rule

**Before creating ANY new file, module, component, or function:**
1. Search the existing codebase for reusable elements
2. Evaluate fitness for reuse or extension
3. Document why no reusable option was applicable if creating new

This prevents fragmentation, redundant complexity, and uncontrolled divergence.

### 💬 Code Comment Requirements

**All code must include TWO types of comments:**

1. **Functional Explanation** — What does this code accomplish?
2. **Strategic Justification** — Why was this approach chosen in the system context?

Example:
```javascript
// FUNCTIONAL: Creates organization-specific database connections with pooling
// STRATEGIC: Multi-tenant isolation requires separate DB instances per organization
export function createOrgDbConnection(organizationId) { ... }
```

### 🚫 Prohibited Actions

**NEVER do these:**
- **Tests**: Testing is explicitly prohibited (MVP factory approach)
- **Breadcrumbs**: Navigation breadcrumbs are banned across all interfaces
- **Hardcoded Field Names**: Always use constants from `fieldNames.js`
- **Localhost MongoDB**: Only Atlas connections allowed
- **Non-Semantic Versioning**: Must follow MAJOR.MINOR.PATCH format
- **Markdown for URLs**: Never use `http://localhost:3000**` (double asterisks break links)

### ✅ Mandatory Actions

**ALWAYS do these:**
- **ISO 8601 Timestamps**: Format `YYYY-MM-DDTHH:MM:SS.sssZ` for all timestamps
- **Comprehensive Comments**: Both functional and strategic explanations required
- **Field Name Constants**: Import and use `fieldNames.js` constants everywhere
- **Documentation Sync**: Update all relevant .md files when making changes
- **Version Consistency**: Version must match across package.json, UI, and all docs
- **Build Verification**: Always verify `npm run build` passes before commit
- **Co-Author Attribution**: Include `Co-Authored-By: Warp <agent@warp.dev>` in all commits

### 📝 AI Conversation Logging

**For planning sessions, record in:**
- `WARP.DEV_AI_CONVERSATION.md` — Plans, decisions, outcomes
- Include: timestamp, author, scope, actions, verification, next steps

---

## Development Workflow

### Standard Development Cycle

```
1. Increment PATCH version in package.json
2. Make code changes
3. Test manually in development (npm run dev)
4. Verify build passes (npm run build)
5. Increment MINOR version, reset PATCH to 0
6. Update ALL documentation files with new version and ISO 8601 timestamps
7. Commit with clear message and Co-Authored-By line
8. Push to GitHub
```

### Major Release Protocol

**When instructed to record a major update:**

1. **Version Upgrade**: Increment MAJOR (e.g., 7.2.1 → 8.0.0)
2. **Comprehensive Documentation Update**: Revise all relevant docs
3. **Document Learnings**: Update LEARNINGS.md
4. **Verify Development Stability**: Ensure error-free operation
5. **Commit and Push**: With versioned message

No step may be skipped.

### Definition of Done

**A task is complete ONLY when:**

1. ✅ Changes manually verified in development
2. ✅ Version incremented and reflected everywhere
3. ✅ ALL documentation updated:
   - ARCHITECTURE.md
   - TASKLIST.md
   - LEARNINGS.md
   - README.md
   - RELEASE_NOTES.md
   - ROADMAP.md
4. ✅ Build passes (`npm run build`)
5. ✅ Committed and pushed to main

**Do NOT commit until build passes and dev is approved.**

---

## Stack & Dependencies

### Core Technologies (DO NOT CHANGE without approval)
- **Runtime**: Node.js 20+
- **Framework**: Next.js 15.5.3 (Pages Router)
- **Database**: MongoDB 7.0+ (Atlas only)
- **Language**: JavaScript (not TypeScript)
- **Styling**: Custom CSS in `public/styles` + styled-jsx
- **Animations**: @react-spring/web, @use-gesture/react
- **Validation**: zod
- **Analytics**: GA4 (production-only)

### Before Adding Dependencies
1. Check if existing libraries can accomplish the goal
2. Verify compatibility with current stack
3. Document rationale for new dependency
4. Update ARCHITECTURE.md with stack changes

---

## Critical Patterns

### UUID Field Standardization (CRITICAL)

**Location**: `lib/constants/fieldNames.js`

**Standardized field names:**
- `OrganizationUUID` — Organization identifiers
- `SessionUUID` — Session identifiers
- `PlayUUID` — Play session identifiers
- `CardUUID` — Card identifiers
- `DeckUUID` — Deck identifiers

**NEVER use**: `sessionId`, `cardId`, `uuid`, `id`, or any other variations.
**ALWAYS**: Import constants from `fieldNames.js`

```javascript
// ✅ CORRECT
import { UUID_FIELDS } from '@/lib/constants/fieldNames';
const cardId = data[UUID_FIELDS.CARD];

// ❌ WRONG
const cardId = data.cardId;
```

### Multi-Tenant Database Architecture

- **Master Database**: Contains Organization metadata only
- **Per-Organization Databases**: Separate MongoDB databases for each org
- **Connection Management**: Via `buildOrgMongoUri()` in `lib/db.js`
- **Security**: Only MongoDB Atlas connections allowed (localhost prohibited)

### Play Modes

**6 supported modes** (orchestrated via unified API):

1. **vote-only**: Pure comparison-based ranking through repeated vote pairs
2. **swipe-only**: Like/dislike interface, rank by preference order
3. **swipe-more**: Enhanced swiping with smart decision tree
4. **vote-more**: Vote-only per family in hierarchy
5. **rank-only**: Swipe to shortlist, then vote to order liked set
6. **rank-more**: Multi-level family-by-family ranking

**API Endpoints** (unified):
- `POST /api/v1/play/start` — Initialize play session
- `POST /api/v1/play/{playId}/input` — Submit swipe/vote
- `GET /api/v1/play/{playId}/next` — Get next prompt
- `GET /api/v1/play/{playId}/results` — Get final results

### Vote Integrity

**Dual-layer protection against double voting:**
- Client-side: 100ms debouncing
- Server-side: 2-second deduplication window

See: `lib/middleware/` and Play input handlers

### Organization Theming

**Organization-level customization:**
- `backgroundCSS` — Custom animated backgrounds
- `googleFontURL` — Typography customization
- `emojiList` / `iconList` — Visual elements

Applied at runtime via organization context.

---

## Operational Notes

### Rate Limiting
- **Default**: 100 requests/minute per IP
- **Implementation**: `lib/middleware/rateLimit.js`
- Applies to all API endpoints

### Analytics (GA4)
- **Loads**: Only in production when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set
- **Consent**: Defaults to denied; toggle via `window.NARIMATO_setAnalyticsConsent()`
- **Events**: play_start, swipe_action, vote_cast, segment_end, play_complete, results_view
- **Privacy**: IP anonymization enabled on all hits

### Security
- **MongoDB**: Atlas-only connections
- **Secrets**: Never expose in plain-text; use environment variables
- **CORS**: Configured via Next.js config
- **Headers**: XSS, CSRF, Frame Options, CSP in production

### Common Issues & Solutions

#### Webpack Cache Corruption
```bash
rm -rf .next
npm run dev
```

#### Field Name Consistency Errors
- Use ESLint rule `field-naming-consistency` (`.eslintrc.field-names.js`)
- Always import constants from `fieldNames.js`

#### Build Failures
- Verify all imports resolve correctly
- Check for missing environment variables
- TypeScript errors are ignored during build (MVP mode)

---

## Quick Reference

### File Structure
```
narimato/
├── pages/              # Next.js Pages Router (UI + API)
├── lib/                # Core logic (models, services, utils)
├── scripts/            # Database management
├── docs/               # Technical documentation
├── public/styles/      # CSS files
├── README.md           # Product overview
├── ARCHITECTURE.md     # Technical architecture
├── WARP.md             # This file (AI rules)
├── TASKLIST.md         # Active tasks
├── ROADMAP.md          # Future plans
├── RELEASE_NOTES.md    # Version history
├── LEARNINGS.md        # Development insights
└── package.json        # Dependencies & scripts
```

### Remember

✅ **Do This**
- Import UUID constants from `fieldNames.js`
- Update ALL docs before commit
- Use ISO 8601 timestamps with milliseconds
- Increment versions per protocol
- Verify build passes before commit
- Include co-author line in commits

❌ **Never Do This**
- Create tests (prohibited)
- Use breadcrumbs (banned)
- Hardcode field names
- Connect to localhost MongoDB
- Skip documentation updates
- Commit without build verification

---

**This document is the authoritative reference for all AI agents working in this repository. When in doubt, follow the patterns established in existing code and always update documentation when making changes.**
