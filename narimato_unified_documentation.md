#NARIMATO - Technical Specification v2.0

This document is a single source of truth for NARIMATO development

## 1. Project Overview
NARIMATO is an anonymous, session-based card ranking application where users interact with visual content through a two-phase process: **Swipe** and **Vote**. The application generates both personal rankings (based on individual user preferences) and global rankings (aggregated from recent user sessions).

### Key Features
- Anonymous sessions (no user registration required)
- Two-phase interaction model (Swipe → Vote)
- Real-time global ranking updates
- Responsive design for all devices
- Admin panel for content management

---
## 2. Core Concepts
### 2.1 Card
A visual content unit displayed to users.

**Structure:**
- `uuid`: Unique identifier (string)
- `type`: Content type ("text" or "media")
- `content`: Object containing either text or media URL
- `title`: Optional display title (string)
- `slug`: Originally generated from content (string)
- `tags`: Optional categorization tags (array of strings)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

### 2.2 Deck
A randomized collection of all cards assigned to a session at startup.

**Properties:**
- **Immutability**: Order and composition cannot change once generated
- **Uniqueness**: Each session receives a unique deck instance
- **Generation**: Randomly selected from active card pool at session creation
- **Constraints**: No duplicate cards within a single deck

**Deck Mutation Rules:**
- ❌ **Cannot** add/remove cards during active session
- ❌ **Cannot** reorder cards once generated  
- ✅ **Can** mark cards as inactive (affects future decks only)
- ✅ **Can** handle deleted cards gracefully (session continues, card skipped)

### 2.3 Session
An anonymous container for all user interactions within a single ranking cycle.

**Lifecycle:**
1. **Creation**: Auto-generated on first deck request (`POST /api/session/start`)
2. **Active**: User progresses through swipe and vote phases (max 2 hours)
3. **Idle**: Session paused if user inactive >30 minutes
4. **Completion**: All interactions recorded, ranking finalized
5. **Expiration**: Sessions expire after 24 hours or browser close

**Properties:**
- Identified by cryptographically secure UUID
- Stores all swipes, votes, and ranking data
- No persistent user identification required
- **Persistence**: Client-side (localStorage) + server backup
- **Recovery**: Cannot resume, fresh start requirement
- **Invalidation**: Corruption or tampering triggers fresh start requirement

**Session Data:**
```json
{
  "sessionId": "uuid",
  "status": "active | completed | expired",
  "createdAt": "ISO8601",
  "lastActivity": "ISO8601",
  "expiresAt": "ISO8601"
}
```

### 2.4 Swipe
Initial user interaction indicating preference for cards.

**Directions & Semantics:**
- **Right swipe**: Express interest (card enters ranking process)
- **Left swipe**: Express disinterest (card discarded)
- **Up/Down swipes**: Not supported

**Data Structure:**
Each swipe generates:
```json
{
  "cardId": "uuid",
  "direction": "right | left",
  "timestamp": "ISO8601",
  "sessionId": "uuid"
}
```

**Transition Logic:**
- First right swipe: Stored, user continues swiping
- Subsequent right swipes: Triggers voting phase immediately against last ranked card

### 2.5 Vote
Comparative evaluation between cards to establish precise ranking order.

**Process:**

* Triggered after second right swipe
* Binary comparison: "Which do you prefer, A or B?"
* Determines exact position in personal ranking

---
## 3. User Flow
### Phase 1: Swipe
1. User receives a deck of randomized cards
2. Cards are presented one at a time
3. User swipes right (like) or left (dislike)
4. 	Remove the current card from the DECK permanently and it will never appear again in this session.
5. First right swipe add card as #1 in rankingList.
6. Move to next card from DECK.
7. Subsequent right swipes triggers voting phase

### Phase 2: Vote
1. Each round:
	* 	Show comparison: votingCandidate vs compareWith
	*  User selects the better one
	* User selects preferred card in each comparison
	* Card is inserted at appropriate ranking position

2. If votingCandidate wins:
* If compareWith is the top-ranked card:
	* Insert votingCandidate above it (new #1)
	* Clear voting state
	* Return to SWIPE
* Else:
	* Pick next compareWith randomly from those ranked above the losing card
	* Repeat voting

3. If votingCandidate loses:
	* Pick next compareWith randomly from those ranked below the winner
	* Repeat voting

4. If no more comparisons are possible (exhausted):
* Insert votingCandidate at the correct position
* Clear voting state
* Return to SWIPE

> Process repeats for each subsequent right swipe!

### Phase 3: Completion
1. Session ends when deck is exhausted or user exits
2. Personal ranking is finalized
3. Global rankings are updated immediately
4. Results are displayed to user

---

## 4. API Specification

### 4.0 API Standards
- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer token for admin endpoints only
- **Rate Limiting**: 100 requests/minute per IP
- **Validation**: Zod schemas for all endpoints
- **Status Codes**: 
  - `200`: Success
  - `201`: Created
  - `400`: Bad Request (validation error)
  - `401`: Unauthorized
  - `404`: Not Found  
  - `429`: Rate Limited
  - `500`: Internal Server Error


## 5. User Interface Requirements

### 5.1 Responsive Design
**Breakpoints:**
- Mobile Portrait: ≤639px
- Mobile Landscape/Tablet Portrait: 640-1023px
- Tablet Landscape: 1024-1279px
- Desktop: ≥1280px

### 5.2 Card Display Rules
**Text Cards:**
- Use `object-fit: contain`
- Scale text to fit container without cropping
- Preserve aspect ratio
- Allow letterboxing if necessary

**Media Cards:**
- Use `object-fit: cover`
- Scale to fill container completely
- Preserve aspect ratio
- Allow cropping if necessary

### 5.3 Swipe Interactions

**Desktop Implementation:**
- **Drag & Drop**: Mouse drag with minimum 50% card width threshold
- **Keyboard**: Left/Right arrow keys for navigation
- **Click Zones**: Left 20% (dislike) / Right 20% (like) of card area
- **Animation**: 300ms ease-out swipe animation with directional feedback

**Mobile Implementation:**
- **Touch Gestures**: Native swipe detection
- **Thresholds**: 50% card width OR velocity >0.3px/ms
- **Haptic Feedback**: Light impact on swipe recognition (iOS)
- **Visual Feedback**: Real-time card rotation during drag

**Technical Implementation:**
```javascript
// React implementation example
const SwipeableCard = ({ card, onSwipe }) => {
  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipe(card.uuid, 'left'),
    onSwipedRight: () => onSwipe(card.uuid, 'right'),
    threshold: 50, // 50px minimum
    velocity: 0.3,
    trackMouse: true // Enable desktop drag
  });
  
  return (
    <div {...handlers} className="swipeable-card">
      {/* Card content */}
    </div>
  );
};
```

**Animation States:**
- **Dragging**: Real-time rotation (-15° to +15°) based on drag position
- **Swipe Success**: Card slides off screen in swipe direction (300ms)
- **Swipe Cancel**: Card springs back to center (200ms ease-out)
- **Loading**: Subtle pulse animation while next card loads

### 5.4 Vote Interactions
**Layout:**
- Landscape orientation: Left/Right card placement
- Portrait orientation: Top/Bottom card placement

**Interactions:**
- Desktop: Click preferred card
- Desktop: Use arrow keys to choose preffered card
- Mobile: Tap preferred card

**Animations:**
- Selected card: Swipe-out animation (300ms, ease-out)
- Non-selected card: Fade-out animation (100ms, linear)

---

## 7. Ranking System

### 7.1 Personal Ranking Logic

**Generation Process:**
- Built incrementally through vote comparisons
- Each new right-swiped card is compared against existing ranked cards
**Complete ranking**: All right-swiped cards included

**Storage**: Full personal ranking saved in PersonalRankingSchema

**Edge Cases:**
- **Single card**: Automatically rank 1, no voting required
- **User exits early**: Current ranking state deleted, cannot be resumed
- **Tied votes**: No tied. First vote result determines position (no revoting)

### 7.2 Global Ranking
**Point Allocation:**
Only the top 10 cards from each completed personal ranking receive points:
- Rank 1: 10 points
- Rank 2: 9 points
- Rank 3: 8 points
- Rank 4: 7 points
- Rank 5: 6 points
- Rank 6: 5 points
- Rank 7: 4 points
- Rank 8: 3 points
- Rank 9: 2 points
- Rank 10: 1 point
- Rank 11+: 0 points

**Recalculation Logic:**
- **Trigger**: Immediately after each session completion
- **Method**: Real-time recalculation (not batched)
- **Window**: Rolling 100 most recent completed sessions
- **Performance**: Optimized MongoDB aggregation pipeline

```javascript
// Aggregation pipeline for global ranking calculation
const globalRankingPipeline = [
  // Get last 100 completed sessions
  { $match: { contributedToGlobal: false, completedAt: { $exists: true } } },
  { $sort: { completedAt: -1 } },
  { $limit: 100 },
  
  // Unwind rankings and assign points
  { $unwind: { path: "$ranking", includeArrayIndex: "rank" } },
  { $match: { rank: { $lt: 10 } } }, // Only top 10
  { $addFields: { points: { $subtract: [10, "$rank"] } } },
  
  // Group by card and sum points
  { $group: {
    _id: "$ranking",
    totalScore: { $sum: "$points" },
    appearanceCount: { $sum: 1 },
    avgRank: { $avg: "$rank" }
  }},
  
  // Sort by total score descending
  { $sort: { totalScore: -1, avgRank: 1 } }
];
```

**Tie Breaking Strategy:**
1. **Primary**: Total score (higher wins)
2. **Secondary**: Average rank (lower wins)  
3. **Tertiary**: Card creation timestamp (newer wins)
4. **Fallback**: Lexicographic UUID comparison

---

## 8. Session Management

### 8.1 Session Lifecycle
1. **Creation:** New session ID generated on deck request
2. **Active:** User progresses through swipe and vote phases
3. **Completion:** All interactions recorded, ranking finalized
4. **Expiration:** Sessions older than 24 hours are archived

### 8.2 Data Persistence
- **Primary:** Client-side storage (localStorage)
- **Backup:** Server-side storage for recovery
- **Sync:** Periodic synchronization to prevent data loss

### 8.3 Data Retention & Cleanup

**Session Data:**
- **Active Sessions**: Retained for 24 hours from creation
- **Completed Sessions**: Archived for 30 days, then deleted
- **Expired Sessions**: Automatically deleted via MongoDB TTL index
- **Vote History**: Preserved for 30 days post-completion for analytics

**Personal Rankings:**
- **Current Window**: Last 100 rankings kept for global calculation  
- **Historical**: Older rankings archived monthly, aggregated statistics preserved
- **Cleanup**: Automated job runs daily at 2 AM UTC

**Global Rankings:**
- **Live Data**: Current rankings maintained indefinitely
- **History**: Daily snapshots stored for trend analysis
- **Recalculation**: Can be triggered manually via admin panel

---

## 9. Security & Privacy

### 9.1 Privacy Protection
- No user registration or identification required
- Session IDs are randomly generated UUIDs
- No personal data collection
- Anonymous analytics only

### 9.2 Data Validation & Integrity

**Request Validation (Zod):**
- All API endpoints validate payloads against predefined schemas
- Type safety enforced at runtime
- Custom validation rules for business logic
- Detailed error messages returned for invalid requests

**Session Integrity:**
- **Tampering Detection**: Session hash verification on each request
- **Card Existence**: All referenced cards validated against active card pool
- **Vote Consistency**: Winner must be one of the two compared cards
- **Sequence Validation**: Votes must reference previously swiped cards

**Rate Limiting:**
- **Per IP**: 100 requests/minute general limit
- **Per Session**: 1 swipe/second, 1 vote/2 seconds to prevent spam
- **Admin Endpoints**: 20 requests/minute for management operations
- **Escalation**: Temporary IP blocks for repeated violations

### 9.3 Security Measures & Abuse Prevention

**Anonymous User Tracking:**
- **Primary**: Cryptographically secure session UUIDs (128-bit entropy)
- **Fallback**: Browser fingerprinting for duplicate session detection
- **Privacy**: No personal data collection, IP addresses hashed

**Session Security:**
- **Signed Tokens**: JWT tokens with server-side secret for session validation  
- **Expiration**: Hard timeout after 2 hours active use
- **Rotation**: New token issued every 30 minutes of activity
- **Invalidation**: Immediate token revocation on suspicious activity

**Abuse Mitigation:**
- **Bot Detection**: Basic behavioral analysis (swipe timing patterns)
- **Duplicate Prevention**: Browser fingerprint + IP combination tracking
- **Volume Limits**: Max 5 completed sessions per IP per day
- **Quality Control**: Sessions with <3 right swipes flagged as potential spam

**Infrastructure Security:**
- HTTPS enforcement with HSTS headers
- CORS configured for specific allowed origins only
- CSP headers to prevent XSS attacks
- No sensitive data in client-side storage

---

## 10. Admin Panel

### 10.1 Authentication
- Token-based authentication
- Admin-only access
- Session timeout after inactivity

### 10.2 Card Management
**Features:**
- Create new cards (text or media)
- Edit existing card content
- Delete cards (with impact analysis)
- Bulk import/export functionality

**Data Impact Handling:**
- Card modifications trigger ranking recalculation
- Historical data cleanup for deleted cards
- Active session handling for modified cards

### 10.3 Analytics Dashboard & Monitoring

**Real-time Metrics:**
- **Session Stats**: Active sessions, completion rate, average duration
- **Card Performance**: Swipe ratios, ranking frequency, global score trends  
- **System Health**: API response times, error rates, database performance
- **User Behavior**: Swipe patterns, vote consistency, dropout points

**Admin Interface Components:**
```
Dashboard Layout:
├── Overview Cards (sessions today, completion rate, active users)
├── Card Management Table (CRUD operations, performance metrics)
├── Session Monitor (real-time active sessions, recent completions)
├── Global Ranking Display (live leaderboard with score history)
├── Analytics Charts (trends, funnels, performance over time)
└── System Status (API health, database status, error logs)
```

**Card Management Features:**
- **Bulk Operations**: Upload multiple cards via CSV import
- **Preview Mode**: Test cards in isolation before going live
- **Performance Metrics**: Click-through rates, ranking frequency
- **Content Validation**: Automatic checks for broken media URLs
- **Impact Analysis**: Preview of ranking changes before card deletion

---

## 11. Analytics & Logging

### 11.1 Event Tracking & Analytics

**Core User Events:**
```javascript
// Google Analytics 4 Event Structure
const analyticsEvents = {
  // Session Lifecycle
  'session_start': {
    session_id: 'uuid',
    deck_size: ,
    timestamp: 'ISO8601'
  },
  
  'session_complete': {
    session_id: 'uuid', 
    duration_seconds: 180,
    cards_swiped: 12,
    cards_ranked: 8,
    completion_rate: 0.8
  },
  
  'session_abandon': {
    session_id: 'uuid',
    exit_point: 'swipe | vote | results',
    duration_seconds: 45,
    progress_percentage: 0.3
  },
  
  // User Interactions  
  'card_swipe': {
    card_id: 'uuid',
    direction: 'left | right',
    swipe_time_ms: 1200,
    card_position: 3 // Position in deck
  },
  
  'card_vote': {
    card_a: 'uuid',
    card_b: 'uuid', 
    winner: 'uuid',
    vote_time_ms: 2500,
    comparison_round: 2
  },
  
  // System Events
  'ranking_update': {
    trigger: 'session_complete',
    cards_affected: 12,
    calculation_time_ms: 150
  },
  
  'error_occurred': {
    error_type: 'validation | network | server',
    error_code: 'INVALID_CARD_ID',
    session_id: 'uuid',
    endpoint: '/api/v1/vote'
  }
};
```

**Funnel Analysis:**
- **Acquisition**: Deck loading success rate
- **Activation**: First swipe completion  
- **Engagement**: Vote participation rate
- **Completion**: Full session completion
- **Retention**: Return visits (tracked via browser fingerprint)

### 11.2 Implementation
- Google Analytics 4 integration
- Custom event logging for detailed analytics
- No personally identifiable information (PII) collection
- Data retention policies compliance

---

## 12. Performance Requirements

### 12.1 Response Times
- API endpoints: <200ms average response time
- Card loading: <100ms per card
- Animation smoothness: 60fps target
- Global ranking updates: <500ms

### 12.2 Scalability
- Support for 1000+ concurrent sessions
- Database indexing on frequently queried fields
- Efficient aggregation for global rankings
- CDN integration for media assets

### 12.3 Optimization
- Image compression and lazy loading
- Client-side caching strategies
- Database connection pooling
- Memory-efficient vote processing

---

## 13. Error Handling & Edge Cases

### 13.1 Session Lifecycle Errors

**Abandoned Sessions:**
```javascript
// Handle user exits mid-interaction
const handleSessionAbandon = (sessionId, exitPoint) => {
  // Mark session as abandoned
  await Session.updateOne(
    { sessionId }, 
    { 
      status: 'abandoned',
      abandonedAt: new Date(),
      exitPoint: exitPoint // 'swipe' | 'vote' | 'results'
    }
  );
  
  // Clean up incomplete data
  if (exitPoint === 'vote') {
    // Save partial ranking state for potential resume
    await savePartialRanking(sessionId);
  }
  
  // Log for analytics
  analytics.track('session_abandon', { sessionId, exitPoint });
};
```

**Session Timeout Handling:**
- **Idle Detection**: 30 minutes of inactivity triggers warning
- **Auto-save**: Current progress saved every 60 seconds
- **Grace Period**: 5 minutes to resume before expiration
- **Recovery**: Sessions can be resumed within 24 hours

**Card Deletion During Active Session:**
```javascript
const handleCardDeletion = async (cardId) => {
  // Find all active sessions using this card
  const activeSessions = await Session.find({
    deck: cardId,
    status: 'active'
  });
  
  for (const session of activeSessions) {
    // Remove card from deck
    session.deck = session.deck.filter(id => id !== cardId);
    
    // If card was already ranked, remove from ranking
    session.personalRanking = session.personalRanking.filter(id => id !== cardId);
    
    // Mark session for ranking recalculation on completion
    session.requiresRecalculation = true;
    
    await session.save();
  }
};
```

### 13.2 Vote Logic Edge Cases

**Single Card Scenario:**
- **Condition**: User only swipes right on one card
- **Behavior**: Card automatically ranked #1, no voting required
- **UI**: Skip vote phase, proceed directly to results

**No Vote Opponent Available:**
```javascript
const handleNoOpponent = (newCard, currentRanking) => {
  if (currentRanking.length === 0) {
    // First card - auto rank #1
    return [newCard];
  }
  
  // No valid opponents (all cards deleted/invalid)
  // Place at end of current ranking
  return [...currentRanking, newCard];
};
```

**Vote Timeout:**
- **Timeout**: 60 seconds per vote decision
- **Fallback**: If no response, randomly assign winner and log timeout
- **UI**: Clear timeout indicator, auto-proceed warning

### 13.3 Data Consistency Errors

**Database Connection Failures:**
```javascript
const handleDbError = async (operation, retryCount = 0) => {
  try {
    return await operation();
  } catch (error) {
    if (retryCount < 3 && error.name === 'MongoNetworkError') {
      // Exponential backoff retry
      await delay(Math.pow(2, retryCount) * 1000);
      return handleDbError(operation, retryCount + 1);
    }
    
    // Log error and return user-friendly message
    logger.error('Database operation failed', { error, retryCount });
    throw new AppError('Service temporarily unavailable', 503);
  }
};
```

**Ranking Calculation Failures:**
- **Detection**: Checksum validation after each global ranking update
- **Recovery**: Automatic recalculation from source data
- **Fallback**: Use last known good ranking if recalculation fails
- **Alert**: Admin notification for manual intervention

### 13.4 Client-Side Error Recovery

**Network Connectivity Issues:**
```javascript
// Progressive retry with exponential backoff
const apiRetry = async (apiCall, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Queue operations when offline
const offlineQueue = {
  operations: [],
  
  add(operation) {
    this.operations.push({
      ...operation,
      timestamp: Date.now()
    });
  },
  
  async flush() {
    const operations = [...this.operations];
    this.operations = [];
    
    for (const op of operations) {
      try {
        await apiRetry(() => op.apiCall());
      } catch (error) {
        // Re-queue failed operations
        this.operations.push(op);
      }
    }
  }
};
```

**Local Storage Corruption:**
- **Detection**: JSON parse failures or invalid session structure
- **Recovery**: Clear corrupted data, start fresh session
- **Prevention**: Data integrity checks before saving
- **Backup**: Server-side session state as fallback

### 13.5 Error Response Standards

**API Error Format:**
```json
{
  "error": {
    "code": "INVALID_CARD_ID",
    "message": "The specified card does not exist or is inactive",
    "details": {
      "cardId": "uuid-here",
      "sessionId": "session-uuid"
    },
    "timestamp": "2025-07-27T10:30:00Z",
    "requestId": "req-uuid-for-tracing"
  }
}
```

**Error Code Categories:**
- **1xxx**: Client errors (validation, malformed requests)
- **2xxx**: Authentication/authorization errors  
- **3xxx**: Business logic errors (invalid state transitions)
- **4xxx**: Resource errors (not found, deleted, inactive)
- **5xxx**: System errors (database, external services)

**User-Facing Error Messages:**
- **Generic**: "Something went wrong. Please try again."
- **Actionable**: "This card is no longer available. Continuing with next card."
- **Recoverable**: "Connection lost. Retrying automatically..."
- **Fatal**: "Session expired. Starting fresh session..."

---

## 14. Implementation Guidelines

### 14.1 Technology Stack
**Frontend:**
- React/Next.js for web application
- TypeScript for type safety
- Tailwind CSS for styling
- Framer Motion for animations

**Backend:**
- Node.js with Express or similar framework
- MongoDB Atlas for data persistence
- Zod for request validation
- JWT for admin authentication

### 14.2 Development Phases
**Phase 1:** Core functionality (swipe, vote, basic ranking)
**Phase 2:** UI polish and responsive design
**Phase 3:** Admin panel and analytics
**Phase 4:** Performance optimization and testing

### 14.3 Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for user flows
- Cross-browser compatibility testing
- Mobile device testing

### 14.4 Deployment & Infrastructure

**Environment Configuration:**
```javascript
// config/environments.js
const environments = {
  development: {
    DATABASE_URL: 'mongodb://localhost:27017/narimato_dev',
    SESSION_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
    RATE_LIMIT_RPM: 1000, // Higher limit for dev
    DECK_SIZE: ,
    LOG_LEVEL: 'debug'
  },
  
  staging: {
    DATABASE_URL: process.env.MONGODB_STAGING_URL,
    SESSION_TIMEOUT: 2 * 60 * 60 * 1000,
    RATE_LIMIT_RPM: 100,
    DECK_SIZE: ,
    LOG_LEVEL: 'info'
  },
  
  production: {
    DATABASE_URL: process.env.MONGODB_PRODUCTION_URL,
    SESSION_TIMEOUT: 2 * 60 * 60 * 1000,
    RATE_LIMIT_RPM: 100,
    DECK_SIZE: ,
    LOG_LEVEL: 'warn',
    ENABLE_ANALYTICS: true,
    CDN_URL: process.env.CDN_URL
  }
};
```

**Database Migration Strategy:**
```javascript
// migrations/001_initial_setup.js
const migration = {
  version: '1.0.0',
  description: 'Initial database setup with indexes',
  
  async up(db) {
    // Create collections with indexes
    await db.collection('cards').createIndexes([
      { key: { uuid: 1 }, unique: true },
      { key: { isActive: 1, createdAt: -1 } },
      { key: { type: 1 } }
    ]);
    
    await db.collection('sessions').createIndexes([
      { key: { sessionId: 1 }, unique: true },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      { key: { status: 1, createdAt: -1 } }
    ]);
    
    await db.collection('globalrankings').createIndexes([
      { key: { cardId: 1 }, unique: true },
      { key: { totalScore: -1 } }
    ]);
  },
  
  async down(db) {
    await db.dropDatabase();
  }
};
```

**Monitoring & Alerting:**
- **Health Checks**: `/api/v1/health` endpoint with database connectivity
- **Metrics Collection**: Prometheus metrics for response times, error rates
- **Log Aggregation**: Structured logging with correlation IDs
- **Alert Thresholds**: 
  - Error rate >5% triggers immediate alert
  - Response time >500ms triggers warning
  - Database connection failures trigger critical alert

**Backup & Recovery:**
- **Database Backups**: Daily automated backups with 30-day retention
- **Point-in-time Recovery**: MongoDB Atlas automated backups
- **Session Data**: Real-time replication across regions
- **Disaster Recovery**: RTO 4 hours, RPO 1 hour maximum

**Platform Compatibility Matrix:**

| Platform | Support Level | Features | Notes |
|----------|--------------|----------|-------|
| iOS Safari | Full | Touch gestures, haptics | Primary mobile target |
| Android Chrome | Full | Touch gestures | Primary mobile target |
| Desktop Chrome | Full | Keyboard, mouse | Primary desktop target |
| Desktop Firefox | Full | Keyboard, mouse | Full compatibility |
| Desktop Safari | Partial | Limited gesture support | Basic functionality |
| Mobile Firefox | Basic | Touch only | Fallback support |
| Internet Explorer | None | N/A | Not supported |

**Offline Support Strategy:**
```javascript
// Progressive Web App capabilities
const offlineStrategy = {
  // Cache essential assets
  cacheFirst: [
    '/api/v1/session/start', // Session creation
    '/static/images/*', // Card images
    '/static/css/*', // Stylesheets
    '/static/js/*' // JavaScript bundles
  ],
  
  // Queue user actions when offline
  backgroundSync: [
    'swipe-action', // Queue swipes for later sync
    'vote-action', // Queue votes for later sync
    'session-complete' // Queue completion events
  ],
  
  // Fallback for critical operations
  networkFirst: [
    '/api/v1/global-ranking', // Always fetch fresh
    '/api/v1/admin/*' // Admin operations require connectivity
  ]
};

// Service Worker implementation
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncQueuedOperations());
  }
});
```

---

## 15. API Versioning & Future Compatibility

### 15.1 Version Management
- **Current Version**: `v1` (all endpoints prefixed with `/api/v1/`)
- **Deprecation Policy**: 6 months notice before version retirement
- **Backward Compatibility**: Maintain previous version during transition
- **Migration Path**: Clear upgrade documentation for breaking changes

### 15.2 Schema Evolution
```javascript
// Version-aware schema validation
const getSchemaVersion = (request) => {
  return request.headers['api-version'] || 'v1';
};

const validateRequest = (schema, version = 'v1') => {
  const versionedSchema = schemas[version][schema];
  return (req, res, next) => {
    const result = versionedSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.errors
        }
      });
    }
    next();
  };
};
```

### 15.3 Future Roadmap Considerations
- **Multi-language Support**: i18n infrastructure preparation
- **Advanced Analytics**: User behavior heatmaps, A/B testing framework
- **Social Features**: Shared rankings, community challenges
- **Performance Optimizations**: Image lazy loading, CDN integration
- **Accessibility**: WCAG 2.1 AA compliance, screen reader support
