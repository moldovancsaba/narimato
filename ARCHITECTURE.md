# System Architecture

## System Overview

NARIMATO is a Next.js application with MongoDB Atlas as its database, designed for high performance and scalability. The architecture follows a modular approach with clear separation of concerns.

## Core Components

### 1. Frontend Layer
```
/components
├── Card.js                 # Base card component
├── CardContainer.js        # Responsive wrapper
└── SwipeController.js      # Touch & keyboard handling
```

### 2. Page Structure
```
/pages
├── card/[slug].js         # Single card view/edit
├── project/[slug].js      # Project management
├── swipe.js              # Card swiping interface
├── vote.js               # Head-to-head voting
├── leaderboard.js        # Global rankings
└── dashboard.js          # Admin interface
```

### 3. Data Layer
```
/utils
├── db.js                 # MongoDB connection
├── elo.js                # Rating calculations
├── ranking.js            # Sorting algorithms
└── validateCard.js       # Input validation
```

## Key Features

### Card System
- Image Cards: Maintains original aspect ratio
- Text Cards: Fixed 3:4 ratio with auto-resizing
- Common attributes: slug, type, hashtags, timestamps
- Optional translations for Text cards

### User System
- Anonymous access by default
- UUID session-based identity
- Role-based access control
- Admin dashboard access

### Real-time Features
- Socket.io integration
- Live updates for card changes
- Real-time leaderboard updates
- Activity broadcasting

## Security Architecture

### Authentication
- Session-based authentication
- Role-based access control
- Protected admin endpoints

### Data Validation
- Zod schema validation
- Input sanitation
- Rate limiting per IP/user

## Database Schema

### Card Collection
```typescript
{
  type: "image" | "text",
  content: string,
  hashtags: string[],
  translations?: {
    [locale: string]: string
  },
  slug: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Project Collection
```typescript
{
  name: string,
  description: string,
  cards: ObjectId[],
  createdAt: Date,
  updatedAt: Date
}
```

### User Collection
```typescript
{
  uuid: string,
  role: "admin" | "user" | "guest",
  preferences: {
    darkMode: boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Deployment Architecture

### Environments
1. Development (dev branch)
2. Staging (staging branch)
3. Production (main branch)

### CI/CD Pipeline
- Automated deployments via Vercel
- Environment-specific configurations
- Automatic database migrations
