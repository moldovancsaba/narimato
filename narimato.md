# NARIMATO – Full Implementation Specification

## ✅ Project Overview

**NARIMATO** is a real-time, card-based web application built with Next.js, MongoDB, and Vercel, designed to support dynamic image/text-based card management, user voting, ranking, and leaderboard functionality across global and project-based contexts. The system is designed to be fully responsive, production-grade, and future-proof. It strictly adheres to the AI Developer Rules and enforces clean, reliable, and traceable development.

---

## ✅ STACK & INFRASTRUCTURE

### Hosting & Code

- **Frontend/Backend**: Next.js + React.js
- **Deployment**: Vercel (Production after every feature delivery)
- **Database**: MongoDB Atlas (via mongoose)
- **Codebase**: GitHub
- **Version Control Branches**: `DEV`, `STAGING`, `MAIN`

### External Services

- **Image Hosting**: [ImgBB](https://api.imgbb.com/1/upload)
  - API Key: `9285b95f2c425d764a48cf047e772c1f`
  - File types: JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF
  - Max size: 32MB

---

## ✅ ENVIRONMENT CONFIG

```env
MONGO_URI=mongodb+srv://moldovancsaba:8anDljEVjIiqWjhV@narimato-cluster.rlvnmbx.mongodb.net/?retryWrites=true&w=majority&appName=narimato-cluster
IMGBB_API_KEY=9285b95f2c425d764a48cf047e772c1f
VERCEL_ENV=production
```

---

## ✅ CARD SYSTEM

### CARD TYPES

- **Image Cards**: must use aspect ratio of original image (NO crop, NO overflow, just FIT)
- **Text Cards**: fixed 3:4 aspect ratio; auto-resize text to fill space
- **Common**:
  - Every card is a container
  - Used consistently across all modules (Swipe, Vote, Rank, List, Dashboard, Card Page)
  - Each card has: `slug`, `type`, `hashtags`, `createdAt`, `updatedAt`, and optional `translations` if Text type

### CARD RULES

- CARD is the smallest unit. Every view uses the same base component styled via the outer container.
- Container adjusts size, card adapts content inside based on its type.
- Never place styling logic inside the card – always externally controlled by the container.
- Avoid fixed width/height on cards.

### CARD UI RULES

- Global CSS only (no per-component styles)
- Mobile-first, responsive design
- Layout via Tailwind + MUI if needed
- Containers should use:
  ```css
  w-[min(100vw,500px)] // Adaptive width
  aspect-[3/4] or use object-contain for image
  ```

---

## ✅ USER SYSTEM

- Anonymous access by default
- Logged-in users get UUID session-based identity
- Users can create/edit Cards, Projects
- User roles: `admin`, `user`, `guest`
- Session ID assigned per session
- Admins can see Dashboard and restore soft-deleted records

---

## ✅ CARD MANAGEMENT

- Create/Edit/Delete Cards
- Only images via URL (to ensure comparison & deduplication)
- Text Cards: support i18n (translations stored in DB)
- All Cards:
  - Have unique slug for direct access (`/card/[slug]`)
  - Filterable via `#hashtags`
  - Searchable (Text content only)
  - Can be included in Projects

---

## ✅ PROJECT SYSTEM

- Projects contain Cards
- Each has a slug URL: `/project/[slug]`
- Cards can be reordered by the creator
- Deleting a Card removes it from projects and rankings

---

## ✅ BUSINESS LOGIC

### 1. SWIPE

- Users see one Card at a time
- Swipe Right → Like
- Swipe Left → Skip
- Cards are shown until 2 Likes
- Keyboard Support:
  - Left Arrow → Swipe Left
  - Right Arrow → Swipe Right

### 2. VOTE

- When 2+ Liked Cards exist, show pair of Cards
- User picks one
- Keyboard:
  - Left Arrow → Left Card Wins
  - Right Arrow → Right Card Wins
- Each vote updates local ranking for the Project

### 3. RANK

- Cards ranked within Project context
- User has personal ranking list
- System uses pairwise comparison sorting logic (e.g. MergeSort or QuickSort variant)

### 4. GLOBAL LEADERBOARD

- Uses ELO rating (adjusted dynamically via activity)
- Calculated across all Projects and user interactions
- Cards have globalScore

### 5. PROJECT LEADERBOARD

- Local ranking within Project
- Preference order per user aggregated into weighted scores

---

## ✅ SECURITY

- Zod for schema validation
- Input sanitation
- Rate Limiting:
  - Anonymous: 50 req / 10min
  - Authenticated: 100 req / 10min
  - IP bans for abuse (env-configurable)
- Admin API endpoints protected

---

## ✅ REAL-TIME FEATURES

- Socket.io
  - Card creation/deletion/edit sync
  - Real-time activity broadcast
  - Dashboard indicators: active users, socket status

---

## ✅ DASHBOARD

- /dashboard URL (Admin only)
- Status Indicators:
  - MongoDB: Connected / Not Connected
  - Sockets: Active / Disconnected
  - Users Online
  - API Health (response latency)

---

## ✅ DARK MODE & UI

- Detect system preferences
- Toggle manually → stored in MongoDB
- Applied globally (not just via localStorage)

---

## ✅ DEVELOPMENT & VERSIONING

- GitHub flow: every change must be versioned
- CI/CD: deploy on Vercel after push to `main`
- Strict Definition of Done:
  - ✅ Error-free
  - ✅ Verified by User
  - ✅ Versioned & Tagged
  - ✅ Documented (README, RELEASE\_NOTES)
  - ✅ Deployed

---

## ✅ PROHIBITED PRACTICES

- ❌ No test automation in MVP
- ❌ No hardcoded content
- ❌ No placeholder UI
- ❌ No inline or per-component CSS
- ❌ No duplicate cards/images (validate on submit)

---

## ✅ FILE STRUCTURE SNAPSHOT

```
/pages
  /card/[slug].js       → View/edit single Card
  /project/[slug].js    → Project voting and ranking
  /swipe.js             → Initial Swipe view
  /vote.js              → Head-to-head voting view
  /leaderboard.js       → Global Leaderboard
  /dashboard.js         → Admin system monitor

/components
  Card.js               → Single card display
  CardContainer.js      → Responsive wrapper
  SwipeController.js    → Touch & keyboard logic

/utils
  db.js                 → MongoDB connection handler
  elo.js                → ELO rating logic
  ranking.js            → Local ranking engine
  validateCard.js       → Input validation rules
```

---

**✅ Status: This document replaces all prior plans. Any missing feature must be added explicitly.**

