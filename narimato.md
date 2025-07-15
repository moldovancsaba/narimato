# NARIMATO – Full Implementation Specification

## ✅ Project Overview

**NARIMATO** is a real-time, card-based web application built with **Next.js App Router**, MongoDB, and Vercel. The system supports dynamic image/text-based card management, user interactions through swiping and voting, intelligent ranking, and leaderboards at both personal and global levels. All development must strictly follow AI Developer Rules: clean, error-free, no hardcoded content, maintainable and traceable logic, fully commented code.

---

## ✅ STACK & INFRASTRUCTURE

### Hosting & Code

- **Framework**: Next.js (**App Router only**)
- **Deployment**: Vercel (Production pushed after each feature completion)
- **Database**: MongoDB Atlas via mongoose
- **Code Repository**: GitHub
- **Branches**: `DEV`, `STAGING`, `MAIN`

### External Services

- **Image Hosting**: [ImgBB](https://api.imgbb.com/1/upload)
  - API Key: `9285b95f2c425d764a48cf047e772c1f`
  - Max 32MB, supports JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF

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

- **Image Card**:

  - Uses the image’s native aspect ratio.
  - Absolutely no crop, overflow, or distortion — use `object-contain`.

- **Text Card**:

  - Fixed **3:4** aspect ratio.
  - Text resizes automatically to **fit the entire card**.
  - No crop or overflow allowed.

### Shared Card Behavior

- **CARD is a container.**
- The same card component is used in **SWIPE / VOTE / RANKING / LISTING / DASHBOARD / CARD PAGE**.
- The **container** defines the size and layout — **not** the card.
- **No overlapping cards** on any screen.
- If multiple cards are shown (e.g. vote), each must **fit the available space** within its container.

### UI/Styling Rules

- **Mobile-first**
- Responsive layout via Tailwind
- No per-component CSS – all styling must be global or via tailwind utility classes
- Example container config:
  ```ts
  className="w-[min(100vw,500px)] aspect-[3/4]"
  ```

---

## ✅ USER SYSTEM

- Anonymous users allowed
- Session ID assigned on entry
- Logged-in users identified with UUID
- User roles: `guest`, `user`, `admin`
- Admin access unlocks `/dashboard` and elevated permissions

---

## ✅ CARD MANAGEMENT

- Cards created via URL or multiline import
- Image Cards via Imgbb
- Text Cards support i18n (`translations` array in DB)
- Cards are searchable, hashtag-filterable, and slug-addressable
- URLs: `/card/[slug]`

---

## ✅ PROJECT SYSTEM

- Projects contain Cards
- Slug-based routing: `/project/[slug]`
- User can reorder cards in a project
- Project leaderboard based on session-level ranking
- Projects public by default

---

## ✅ INTERACTION LOGIC

### 1. SWIPE

- Shows one card at a time
- User can swipe:
  - ← Left Arrow → Dislike
  - → Right Arrow → Like
- Two Likes required to unlock VOTE
- Mobile touch or desktop keyboard supported

### 2. VOTE

- Two cards shown:
  - Horizontal (landscape)
  - Vertical stacked (portrait)
- **No overlap allowed** — container must auto-resize cards
- User selects preferred card:
  - ← Left Arrow → select left card
  - → Right Arrow → select right card
- Vote result updates **project session-level ranking**

### 3. RANK

- Local preference ranking per user (project-based)
- Pairwise sorting logic (e.g. MergeSort optimized)
- No need for all votes — partial orders are valid

### 4. GLOBAL LEADERBOARD

- Uses **ELO rating system**
- Global rank affected by user votes across projects
- Rank updated automatically on relevant activity

### 5. PROJECT LEADERBOARD

- Aggregates user rankings into weighted score
- Sessions are tracked anonymously unless logged in

---

## ✅ SECURITY

- Input Validation: Zod
- Rate Limiting:
  - Anonymous: 50 req / 10min
  - Authenticated: 100 req / 10min
- Admin routes require login
- All user input is sanitized and escaped

---

## ✅ REAL-TIME FEATURES

- **Socket.io** implementation
- Real-time sync for:
  - New card creation
  - Voting events
  - Swipe updates
- Realtime data feeds `/dashboard` and `/leaderboard`

---

## ✅ DASHBOARD

- Path: `/dashboard` (admin only)
- Indicators:
  - MongoDB Connection
  - Active User Sessions
  - Realtime socket status
  - Latency on main API routes

---

## ✅ DARK MODE

- System preference by default
- Manual toggle persists in MongoDB
- Tailwind dark mode enabled globally

---

## ✅ FILE STRUCTURE (App Router)

```
/app
  /card/[slug]/page.tsx         → View/edit single Card
  /project/[slug]/page.tsx      → Voting & ranking in a project
  /swipe/page.tsx               → SWIPE interface
  /vote/page.tsx                → VOTE interface
  /leaderboard/page.tsx         → GLOBAL leaderboard
  /dashboard/page.tsx           → Admin tools

/components
  Card.tsx                      → Shared Card Component
  CardContainer.tsx             → Layout manager
  SwipeController.tsx           → Keyboard & gesture handling

/lib
  mongodb.ts                    → DB connector
  elo.ts                        → ELO logic
  rank.ts                       → Sorting-based ranking
  validate.ts                   → All validation rules
```

---

## ✅ DEVELOPER RULES

- Strict Definition of Done:

  - ✅ Works in Vercel PROD
  - ✅ Fully Documented
  - ✅ Commented Code (Plain English)
  - ✅ No test failures
  - ✅ No placeholder code
  - ✅ Fully responsive

- ❌ No shortcut coding

- ❌ No hardcoded values

- ❌ Cards must not overlap on screen

- ❌ All multi-card views must auto-resize containers properly

- ❌ Every component must be reusable

- ❌ Every action must be traceable

---

✅ This document **supersedes all earlier specifications**.\
✅ All previous agreements are consolidated here.\
❗ Any missing feature must be requested explicitly.

