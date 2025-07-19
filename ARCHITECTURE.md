# System Architecture

Last Updated: 2025-07-19T19:15:00.000Z

## Version Status

Current Version: v7.2.0
Status: Active Development

## System Overview

NARIMATO is a Next.js application with TypeScript and Tailwind CSS, using MongoDB Atlas as its database and Redis for caching. The architecture follows a modular approach with clear separation of concerns, emphasizing performance, scalability, and security.

Key Infrastructure Components:
- Next.js + React.js: Frontend and API routes
- MongoDB Atlas: Primary database
- Redis: Caching and rate limiting
- Socket.io: Real-time updates
- Vercel: Deployment and hosting

## Component Hierarchy

### 1. Frontend Layer
```
/components
├── UI/                   # UI primitives
│   ├── Typography.tsx    # Centralized text styling
│   ├── Card.tsx         # Base card component
│   ├── CardContainer.tsx # Card layout management
│   ├── CardFilters.tsx  # Filtering interface
│   ├── CardForm.tsx     # Card creation/editing
│   ├── CardList.tsx     # Card listing component
│   ├── Navigation.tsx   # App navigation
│   ├── SwipeController.tsx # Swipe interactions
│   ├── VoteSystem.tsx   # Voting interface
│   └── LeaderboardCard.tsx # Ranking display
├── Project/             # Project management
│   ├── CardManager.tsx  # Project card organization
│   ├── DeleteProjectModal.tsx # Project deletion confirmation
│   ├── ProjectForm.tsx  # Project creation/editing
│   ├── ProjectSettings.tsx # Project configuration
│   ├── ProjectWithRealtime.tsx # Real-time project updates
│   └── ProjectsMenu.tsx # Project navigation
├── Layout/              # Layout components
│   ├── Container.tsx    # Responsive container
│   └── Grid.tsx        # Grid system
```

### 2. Navigation System & URL Structure

NARIMATO utilizes a sophisticated navigation system with a dual URL structure pattern for maximum usability, stability, and SEO optimization:

#### Component Structure
```typescript
// Core Navigation Components
interface NavigationSystem {
  PublicRoutes: {
    cards: string[];      // Slug-based public card routes
    projects: string[];   // Project visibility routes
    users: string[];      // Public profile routes
  };
  ManagementRoutes: {
    cards: string[];      // MD5-based card management
    projects: string[];   // Project administration
    users: string[];      // User settings & preferences
  };
  middleware: {
    auth: RouteHandler;   // Authentication checks
    access: RouteHandler; // Access control
    redirect: RouteHandler; // Smart redirection
  };
}
```

#### URL Structure

1. Public URLs (Slug-based)
Optimized for readability and SEO:
```
/cards/my-cool-card          # Public card view
/projects/awesome-project    # Public project view
/users/john-doe             # Public user profile
```

2. Management URLs (MD5-based)
Designed for stability and unique identification:
```
/cards/5d41402abc4b2a76b9719d911017c592/edit      # Card management
/projects/8d777f385d3dfec8815d20f7496026dc/edit   # Project management
/users/7d793037a0760186574b0282f2f435e7/settings  # User settings
```

#### Navigation Handlers

1. Route Protection
```typescript
const protectedRoutes = {
  cards: ['/edit', '/delete', '/settings'],
  projects: ['/edit', '/manage', '/configure'],
  users: ['/settings', '/preferences', '/security']
};
```

2. Access Control Logic
```typescript
const accessControl = {
  public: ['view', 'browse', 'search'],
  authenticated: ['create', 'edit', 'delete'],
  admin: ['manage', 'configure', 'moderate']
};
```

3. Special Route Handling
- Dynamic route resolution for slugs vs. MD5 hashes
- Automatic redirection for moved/renamed resources
- Rate limiting for sensitive operations
- Cache-control headers for public routes

### 3. Page Structure
```
/pages
├── index.tsx               # Enhanced homepage design
├── _app.tsx                # Application wrapper with providers
├── cards/
│   ├── [slug].tsx          # Public card view
│   ├── [hash]/
│   │   └── edit.tsx        # Card management interface
│   ├── create.tsx          # Card creation interface
│   └── list.tsx            # Card listing with filters
├── projects/
│   ├── [slug].tsx          # Public project view
│   ├── [hash]/
│   │   └── edit.tsx        # Project management interface
│   └── create.tsx          # Project creation interface
├── users/
│   ├── [slug].tsx          # Public user profile
│   └── [hash]/
│       └── settings.tsx    # User settings interface
├── vote.tsx                # Head-to-head voting
├── leaderboard.tsx         # Global rankings
└── dashboard.tsx           # Admin interface
```

### 3. Data & Utils Layer
```
/utils
├── db/
│   ├── connect.ts       # MongoDB connection handler
│   └── models/          # Mongoose models & schemas
├── validation/
│   ├── card.ts          # Zod schemas for card data
│   └── project.ts       # Project validation schemas
├── services/
│   ├── imgbb.ts         # Image upload service
│   ├── elo.ts           # Rating calculations
│   └── ranking.ts       # Sorting algorithms
└── helpers/            # Utility functions
```

### Data Flow & Integration

### Project Ranking System
The project ranking system uses a modified ELO rating algorithm adapted for project-specific contexts:

```typescript
interface RankingCalculation {
  baseK: number;           // Base K-factor (typically 32)
  projectFactor: number;   // Project-specific multiplier (0.5-2.0)
  voteDelta: number;       // Vote strength (1-10)
  timeDecay: number;       // Time-based decay factor (0.95-1.0)
}

// Ranking Formula:
function calculateNewRating(current: number, expected: number, actual: number, config: RankingCalculation): number {
  const adjustedK = config.baseK * config.projectFactor * config.timeDecay;
  return current + adjustedK * (actual - expected);
}

// Expected Score Calculation:
function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
```

### Vote System Flow
```mermaid
graph TD
    A[User Vote] --> B{Vote Type}
    B -->|Project-Specific| C[Project Context]
    B -->|Global| D[Global Context]
    C --> E[Validate Project Access]
    D --> F[Check Rate Limits]
    E --> G[Apply Project Rules]
    F --> H[Process Vote]
    G --> H
    H --> I[Update Rankings]
    I --> J[Calculate New Scores]
    J --> K[Update Leaderboard]
    K --> L[Trigger Real-time Updates]
    
    subgraph "Ranking Process"
    J --> M[Apply Time Decay]
    J --> N[Consider Project Factor]
    J --> O[Calculate Final Score]
    end
    
    subgraph "Rate Limiting"
    F --> P[Check IP Limits]
    F --> Q[Check Session Limits]
    F --> R[Check Project Limits]
    end
```

## Card Management

### Card Editing System

The card editing system provides a robust interface for managing and editing card content, with a focus on reliability and real-time updates.

#### Components

1. **CardEditForm Component**
   - Handles card content editing
   - Supports both text and image cards
   - Manages card-project relationships
   - Implements real-time validation
   - Provides immediate feedback

2. **Project Association Manager**
   - Manages card-project relationships
   - Handles project selection and removal
   - Updates project references
   - Maintains data consistency

3. **Card Preview Component**
   - Real-time preview of card changes
   - Aspect ratio preservation
   - Mobile/desktop preview modes
   - Theme-aware rendering

#### Edit Flow

```mermaid
graph TD
    A[Edit Request] --> B{Card Type}
    B -->|Image| C[Image Upload]
    B -->|Text| D[Text Editor]
    C --> E[Validation]
    D --> E
    E --> F[Project Association]
    F --> G[Save Changes]
    G --> H[Real-time Update]
    H --> I[UI Refresh]
```

### Card Selection System

The card selection system provides a robust interface for searching, filtering, and managing card selections within projects.

#### Components

1. **API Endpoint** (`/api/cards/search`)
   - Handles card search and filtering requests
   - Supports text search across title, description, and hashtags
   - Implements flexible filtering options (type, score, date range)
   - Returns paginated results with essential card data

2. **useCardSelection Hook**
   - Custom React hook for managing card selection state
   - Features:
     - Debounced search functionality
     - Selection state management
     - Error handling and loading states
     - Type-safe interfaces

#### Data Flow

```mermaid
graph TD
    A[User Interface] -->|Search Query| B[useCardSelection Hook]
    B -->|API Request| C[/api/cards/search]
    C -->|MongoDB Query| D[Card Collection]
    D -->|Results| C
    C -->|JSON Response| B
    B -->|Update State| A
```

#### Search Criteria

The search endpoint supports the following filters:
- Full-text search across title and description
- Card type filtering (image/text)
- Hashtag filtering
- Global score threshold
- Date range filtering

#### Performance Considerations

- Search requests are debounced (300ms)
- Results are limited to 50 cards per request
- MongoDB indexes optimize query performance
- Response includes only essential fields
```mermaid
graph TD
    A[User Action] --> B{Action Type}
    B --> |Create| C[Card Creation]
    B --> |Edit| D[Card Update]
    B --> |Delete| E[Card Deletion]
    B --> |Vote| F[Vote Processing]
    C --> G[Validation]
    D --> G
    E --> H[Soft Delete]
    F --> I[Rate Limiting]
    G --> J[MongoDB Update]
    H --> J
    I --> K[Update Rankings]
    J --> L[Real-time Update]
    K --> L
    L --> M[UI Refresh]
```

### Card Processing Flow
```mermaid
graph TD
    A[User Input] --> B{Card Type}
    B --> |Image| C[ImgBB Upload]
    B --> |Text| D[Translation Check]
    C --> E[Validation]
    D --> E
    E --> F[MongoDB Storage]
    F --> G[UI Update]
```

### Key Features

### Typography System v1.0.0
- Centralized Typography Configuration:
  - Consistent font scales from xs (12px) to 6xl (60px)
  - Responsive text behavior with mobile-first design
  - System fonts with fallbacks for optimal performance
  - Unified line height and letter spacing scales

- Text Components:
  - H1: Large headlines (4xl-6xl) with tight tracking
  - H2: Section headers (3xl-4xl) with medium weight
  - H3: Subsection headers (2xl-3xl) with balanced spacing
  - Body: Main content text with relaxed line height
  - SmallText: Secondary content with normal spacing
  - Caption: Small, muted text for supplementary info

- Design Principles:
  - Mobile-first responsive typography
  - Consistent vertical rhythm
  - Accessible font sizes and contrast
  - Maintainable type scale system

### Card System v1.0.0
- Enhanced Card Components:
  - Image Cards: Original aspect ratio preservation
  - Text Cards: Fixed 3:4 ratio with dynamic resizing
  - Container-based styling system
  - Hashtag support and filtering
  - Optional translation support for all card types

### Image Processing
- ImgBB Integration:
  - Secure upload handling
  - File validation (32MB limit)
  - Supported formats: JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF

### User System
- TypeScript-based session management
- UUID-based identity system
- Role-based access control (RBAC)
- Enhanced admin dashboard

### Real-time Features
- Socket.io integration
- Live updates for card changes
- Real-time leaderboard updates
- Activity broadcasting

## Technical Specifications

### Recent Technical Improvements v1.1.0

#### 1. TypeScript Improvements
```typescript
// SwipeStore Type Corrections
interface SwipeState {
  direction: 'left' | 'right' | null;
  offset: number;
  isDragging: boolean;
  currentCard: string | null;
}

// Zustand Persist Middleware Type Declaration
interface PersistOptions<T> {
  name: string;
  storage?: StorageValue<T>;
  partialize?: (state: T) => Partial<T>;
  version?: number;
  migrate?: (state: T, version: number) => T;
}

type StorageValue<T> = {
  getItem: (name: string) => T | null | Promise<T | null>;
  setItem: (name: string, value: T) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
};
```

#### 2. Backend Stability
```typescript
// Mongoose Model Registration System
class ModelRegistry {
  private static models = new Map<string, mongoose.Model<any>>();

  static register<T>(name: string, schema: mongoose.Schema<T>): mongoose.Model<T> {
    if (!this.models.has(name)) {
      const model = mongoose.model<T>(name, schema);
      this.models.set(name, model);
      return model;
    }
    return this.models.get(name) as mongoose.Model<T>;
  }

  static getModel<T>(name: string): mongoose.Model<T> | undefined {
    return this.models.get(name) as mongoose.Model<T>;
  }
}

// Database Interaction Layer
interface DatabaseOperation<T> {
  execute(): Promise<T>;
  rollback(): Promise<void>;
  validate(): Promise<boolean>;
}

class DatabaseTransaction {
  private operations: DatabaseOperation<any>[] = [];

  async execute<T>(operation: DatabaseOperation<T>): Promise<T> {
    try {
      if (await operation.validate()) {
        const result = await operation.execute();
        this.operations.push(operation);
        return result;
      }
      throw new Error('Validation failed');
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  private async rollback(): Promise<void> {
    for (const op of this.operations.reverse()) {
      await op.rollback();
    }
  }
}
```

#### 3. Component Architecture
```typescript
// ProjectForm Component Structure
interface ProjectFormProps {
  initialData?: Partial<Project>;
  onSubmit: (data: Project) => Promise<void>;
  onCancel: () => void;
}

// Form State Management
interface FormState<T> {
  data: T;
  errors: Record<keyof T, string[]>;
  touched: Set<keyof T>;
  isSubmitting: boolean;
  isDirty: boolean;
}

type FormAction<T> =
  | { type: 'SET_FIELD'; field: keyof T; value: any }
  | { type: 'SET_ERRORS'; errors: Record<keyof T, string[]> }
  | { type: 'TOUCH_FIELD'; field: keyof T }
  | { type: 'SUBMIT_START' | 'SUBMIT_END' | 'RESET' };
```

### Security Architecture

### Security and Access Model v7.0.0

#### Core Components
```typescript
// Rate Limiter
interface RateLimiter {
  isAllowed(key: string): Promise<boolean>;
  increment(key: string): Promise<void>;
  getLimit(key: string): Promise<RateLimit>;
  reset(key: string): Promise<void>;
}

// Security Monitor
interface SecurityMonitor {
  logEvent(event: SecurityEvent): Promise<void>;
  detectThreats(context: RequestContext): Promise<ThreatAssessment>;
  generateAlert(threat: Threat): Promise<void>;
  getMetrics(): Promise<SecurityMetrics>;
}
```

#### Security Features
- Rate Limiting
  - Multi-level rate limiting
  - Adaptive thresholds
  - Distributed rate tracking
  - Automatic ban detection

- Threat Protection
  - Real-time threat detection
  - Automated response system
  - Security event logging
  - Audit trail maintenance

### Access Model
```mermaid
graph TD
    A[User Access] --> B[Public Access]
    B --> C[Read-Only Features]
    B --> D[Rate-Limited Features]
    C --> E[View Content]
    D --> F[Voting with Limits]
    E --> G[Browse Projects]
    F --> H[Rate Cards]
```

#### Access Level Features
- Public Access:
  - Read-only access to all content
  - Basic voting capabilities with rate limits
  - No content creation/editing
  - Rate-limited API access
  - Abuse detection monitoring

### Data Validation & Safety
- Comprehensive Zod schema validation
- Type-safe input handling
- Strict input sanitation
- File type verification

## Database Architecture

### Card Collection
```typescript
interface Card {
  type: 'image' | 'text';
  content: string;          // URL for images, text content for text cards
  hashtags: string[];       // Indexed for efficient filtering
  projects: string[];       // Array of project IDs this card belongs to
  translations?: {
    [locale: string]: {
      content: string;
      lastUpdated: Date;
    }
  };
  metadata: {
    dimensions?: {
      width: number;
      height: number;
    };
    fileSize?: number;      // For images only
    format?: string;        // File format for images
  };
  slug: string;             // URL-friendly unique identifier
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}
```

### Project Collection
```typescript
interface Project {
  name: string;
  description: string;
  cards: ObjectId[];        // References to Card collection
  settings: {
    visibility: 'public' | 'private';
    allowComments: boolean;
    cardOrder: 'manual' | 'date' | 'popularity';
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### User Collection
```typescript
interface User {
  uuid: string;              // Unique identifier
  role: 'admin' | 'user' | 'guest' | 'anonymous';
  sessionType: 'anonymous' | 'authenticated';
  preferences: {
    darkMode: boolean;
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
  anonymousData?: {
    sessionId: string;
    createdAt: Date;
    lastActive: Date;
    votingHistory: string[];  // Array of card IDs voted on
  };
}
```

### Session Collection
```typescript
interface Session {
  sessionId: string;         // Unique session identifier
  userId: string;            // Reference to User collection
  type: 'anonymous' | 'authenticated';
  status: 'active' | 'expired' | 'upgraded';
  deviceInfo: {
    userAgent: string;
    ip: string;
    lastKnownLocation?: string;
  };
  createdAt: Date;
  expiresAt: Date;
  lastActive: Date;
}
```

## Deployment & DevOps

### Package Management

- **Required Package Manager**: npm
  - Version: Latest stable release
  - Usage: All dependency management and script execution
  - Required Files:
    - package.json: Project configuration and scripts
    - package-lock.json: Deterministic dependency tree

### Node.js Requirements
- Node.js: Latest LTS version
- npm: Included with Node.js installation

### Development Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Environment Structure
```mermaid
graph LR
    A[Development] -->|Automated Tests| B[Staging]
    B -->|Manual Approval| C[Production]
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bfb,stroke:#333,stroke-width:2px
```

### CI/CD Pipeline v1.0.0
- Vercel-based deployment automation
- Environment-specific configurations
- TypeScript type checking
- Automated testing pipeline
- Database migration management
- Performance monitoring

### Performance Optimization
- Static page generation where possible
- Image optimization pipeline
- MongoDB query optimization
- Client-side caching strategy
