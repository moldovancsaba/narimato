# Organization-Level Routing & API Audit

**Generated**: 2025-01-14T09:02:27.000Z  
**Status**: Under Migration to Organization-Level Architecture

## Summary

The NARIMATO application is currently in the process of migrating from a global/legacy routing structure to a multi-tenant organization-aware system. This audit documents both current and legacy endpoints to identify conflicts and missing functionality.

## ✅ Organization-Aware Routes (New Structure)

### Frontend Pages
- `/organization/[slug]/card-editor/page.tsx` - ✅ Organization-specific card editor
- `/organization/[slug]/cards/page.tsx` - ✅ Organization-specific card management
- `/organization/[slug]/completed/page.tsx` - ✅ Organization-specific completed sessions
- `/organization/[slug]/play/page.tsx` - ✅ Organization-specific play interface
- `/organization/[slug]/ranks/page.tsx` - ✅ Organization-specific rankings overview
- `/organization/[slug]/ranks/[deck]/page.tsx` - ✅ Organization-specific deck rankings
- `/organization/[slug]/swipe/page.tsx` - ✅ Organization-specific swipe interface
- `/organization/[slug]/vote/page.tsx` - ✅ Organization-specific voting interface

### API Endpoints
- `/api/v1/organization/[slug]/route.ts` - ✅ Organization lookup by slug (caching enabled)
- `/api/v1/organizations/[slug]/route.ts` - ✅ Alternative organization lookup endpoint
- `/api/v1/play/start/route.ts` - ✅ Organization-aware play session creation
- `/api/v1/play/results/[playUUID]/route.ts` - ✅ Organization-aware play results
- `/api/v1/session/results/[sessionUUID]/route.ts` - ✅ Organization-aware legacy session results

## ⚠️ Legacy Routes (Old Structure)

### Frontend Pages (Legacy - May Need Removal)
- `/card-editor/page.tsx` - ❓ Legacy card editor (conflicts with org-specific)
- `/cards/page.tsx` - ❓ Legacy card management (conflicts with org-specific)
- `/completed/page.tsx` - ❓ Legacy completed sessions (conflicts with org-specific)
- `/swipe/page.tsx` - ❓ Legacy swipe interface (conflicts with org-specific)  
- `/vote/page.tsx` - ❓ Legacy vote interface (conflicts with org-specific)
- `/ranks/page.tsx` - ❓ Legacy rankings (conflicts with org-specific)

### API Endpoints (Legacy)
- `/api/v1/session/start/route.ts` - ❌ **ISSUE: Returns 404** - Legacy session start (conflicts with play/start)
- `/api/v1/vote/route.ts` - ❓ Legacy voting endpoint
- `/api/v1/swipe/route.ts` - ❓ Legacy swipe endpoint
- `/api/v1/ranking/route.ts` - ❓ Legacy ranking endpoint
- `/api/v1/rankings/route.ts` - ❓ Legacy rankings endpoint

## 🔧 Organization Context Detection

### Working Detection Methods
1. **Path-based**: `/organization/[slug]/...` routes ✅
2. **Header-based**: `X-Organization-UUID` and `X-Organization-Slug` headers ✅
3. **Subdomain-based**: `{slug}.narimato.com` (implemented but needs testing) ❓

### Middleware & Helpers
- `/app/lib/middleware/organization.ts` - ✅ Organization context detection
- `/app/middleware.ts` - ✅ Rate limiting and security (no org-specific logic)
- `getOrganizationContext()` - ✅ Main organization detection function
- `createOrgDbConnect()` - ✅ Organization-specific database connections

## ❌ Identified Issues

### 1. Session Start 404 Error
**Problem**: `/api/v1/session/start` returns 404  
**Root Cause**: Conflicts with new `/api/v1/play/start` structure  
**Status**: Needs investigation and routing fix

### 2. Route Conflicts
**Problem**: Duplicate routes for same functionality  
**Examples**: 
- `/api/v1/session/start` vs `/api/v1/play/start`
- `/api/v1/ranking` vs `/api/v1/rankings`
- Legacy pages vs organization-specific pages

### 3. Mixed Organization Detection
**Problem**: Some endpoints organization-aware, others not  
**Impact**: Inconsistent data access patterns

### 4. Legacy Endpoints Still Active
**Problem**: Old routes may still be accessible and cause confusion  
**Risk**: Data inconsistency, user confusion

## 📋 Action Items (Prioritized)

### High Priority
1. **Fix session start 404** - Investigate routing conflict
2. **Test organization context detection** - Verify all methods work
3. **Resolve API endpoint conflicts** - Choose canonical endpoints

### Medium Priority  
1. **Audit legacy pages** - Determine which to keep/remove
2. **Standardize organization headers** - Ensure consistent usage
3. **Update client-side calls** - Point to correct endpoints

### Low Priority
1. **Remove dead legacy code** - Clean up unused routes
2. **Document canonical patterns** - Update architecture docs
3. **Add endpoint health checks** - Monitoring and alerting

## 🔍 Next Steps

1. **Test Current Functionality**: Systematically test each endpoint
2. **Identify Root Causes**: Investigate specific 404s and routing issues  
3. **Create Migration Plan**: Phased approach to resolve conflicts
4. **Update Documentation**: Reflect current state and future plans

---

**Note**: This audit is part of the organization-level migration. All changes must follow the project's versioning and documentation protocols.
