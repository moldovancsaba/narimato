# NARIMATO Development Roadmap

**Current Version:** 6.9.0
**Date:** 2025-09-16T07:11:23.000Z
**Last Updated:** 2025-09-16T07:11:23.000Z

> Note: Roadmap contains only forward-looking items. Completed and historical work is tracked in RELEASE_NOTES.md.

## Q3 2025 — Near-Term (Now → Sep 2025)

### Critical Priority
- Error Response Standards (Structured Envelope + Taxonomy)
  - Define and adopt standard envelope: { error: { code, message, details, timestamp, requestId } }
  - Establish taxonomy: 1xxx client, 2xxx auth, 3xxx business-state, 4xxx resource, 5xxx system
  - Deliver centralized error helper; migrate priority endpoints; update API docs

- API Versioning — Phase 2 (v2 Pilot)
  - Publish v2 schema/handlers for play/start with header negotiation (Accept / X-API-Version)
  - Add telemetry and begin deprecation headers (read-only endpoints) while keeping v1 default

### High Priority
- Gesture/Haptics UX Baseline
  - Standardize swipe thresholds; add reduced-motion handling; optional iOS haptics behind feature flag
  - Instrument gameplay analytics for gesture/haptic impact

### Dependencies
- Logging/observability, analytics events, centralized validation

---

## Q4 2025 — Platform Hardening & Governance

### Critical Priority
- API Versioning Negotiation (Header-Based)
  - Design header strategy (X-API-Version or Accept: application/vnd.narimato.vX+json)
  - Middleware to route to versioned zod schemas and handlers
  - Deprecation policy and migration playbook (maintain v1 for 6 months; telemetry for usage; staged warnings → removal)
  - Dependencies: docs/API_REFERENCE.md updates, centralized validation

- Error Response Standards (Structured Envelope + Taxonomy)
  - Define standard envelope { error: { code, message, details, timestamp, requestId } }
  - Adopt taxonomy: 1xxx client; 2xxx auth; 3xxx business-state; 4xxx resource; 5xxx system
  - Central error helper for API routes; update endpoints incrementally
  - Dependencies: Logging/observability and API docs

### High Priority
- Security & RBAC (MVP)
  - Roles: admin, editor, viewer; token-based access for admin routes
  - Abuse mitigation: rate limits, IP/UA heuristics, suspicious pattern flags
  - Dependency: centralized auth utilities; CORS and headers audit

- DB Migration Framework
  - Formal migrations folder, version registry, up/down, dry-run, audit logs, rollback
  - Operational guide and safeguards; environment safety checks (Atlas only)

- API Versioning Expansion (v2 Coverage)
  - Extend v2 to input, next, and results endpoints; formalize deprecation schedule for v1

### Medium Priority
- Gesture/Haptics UX Improvements
  - Unify thresholds across devices; add optional iOS haptics; respect reduced-motion
  - Feature flags and analytics instrumentation

- Admin Panel & Analytics Dashboard (MVP)
  - Overview: sessions today, completion rate, active plays, error rate
  - Funnels/trends: play_start→complete, ELO trend snapshots, latency
  - System health: API latency/error budget, DB status
  - Dependencies: security/RBAC, analytics events, metrics sources
  - Export rankings to various formats (CSV, JSON, PDF)
  - Third-party service integrations
  - Webhook support for external systems
  - Dependencies: Data formatting libraries

## Post-Q4 2025 — Backlog (Forward-Looking)

### Enterprise & Customization
- White-label solution (branding/themes, custom domains)
- Internationalization (multi-language, regional customization)
- Advanced card types (video, interactive) with media pipeline

### Analytics & Reporting
- Custom report generation and exports (CSV/JSON/PDF)
- A/B testing framework and conversion funnel analysis
- BigQuery export and custom dimensions

### AI & Innovation
- AI recommendations and automated card generation
- Advanced visualizations and data storytelling
- Integration ecosystem: plugins, marketplace, SDK
- Platform expansion: native mobile, desktop, browser extension

### Advanced Security
- End-to-end encryption for sensitive data paths
- Enhanced fraud detection and compliance improvements

---

## Ongoing — Technical Debt & Maintenance
- Code quality, comprehensive error handling, documentation currency
- Monitoring/alerting, infra scaling (DB/CDN/load balancing)
- Security & compliance (audits, vulns, certifications)

## Success Metrics

### Q4 2025 Targets
- Header-based version usage: ≥60% of clients on v2 endpoints
- Admin MVP: <500ms p95 for overview endpoint, 0 critical regressions
- Error envelope adoption: 100% of updated endpoints, 0 schema drift issues
- RBAC coverage: 100% on admin routes, 0 unauthorized access findings

### H1 2026 Targets
- Migration framework coverage: 100% for schema/data changes
- API v2 coverage: 100% of unified play endpoints, v1 deprecation window active
- Uptime: ≥99.9%, p95 API latency ≤150ms
- Security posture: 0 high/critical unresolved findings

**Note:** Roadmap is forward-looking only; completed work is tracked in RELEASE_NOTES.md. Timelines/priorities may be adjusted based on progress and stakeholder input.
