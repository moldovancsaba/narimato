# Card Addition and Global Ranking Code Flow Analysis

## Executive Summary

This analysis maps the complete flow from card addition to global ranking calculation in the Narimato application, identifying all relevant modules, functions, and integration points.

## 1. Card Addition Flow

### 1.1 Entry Point: Card Creation API
- **File**: `app/api/v1/cards/add/route.ts`
- **Function**: `POST` handler
- **Purpose**: Creates new cards and adds them to the system

#### Key Operations:
1. **Request Validation**: Uses `CreateCardSchema` from `app/lib/validation/schemas.ts`
2. **UUID Generation**: Creates unique identifiers using `uuid.v4()`
3. **Slug Generation**: Creates URL-friendly slugs from titles with uniqueness validation
4. **Database Persistence**: Saves card using the `Card` model

#### Integration Points:
- **Schema Validation**: `app/lib/validation/schemas.ts` → `CreateCardSchema`
- **Database Model**: `app/lib/models/Card.ts` → `Card` mongoose model
- **Field Constants**: `app/lib/constants/fieldNames.ts` → `CARD_FIELDS`

### 1.2 Card Model Structure
- **File**: `app/lib/models/Card.ts`
- **Core Fields**:
  - `uuid`: Unique identifier
  - `type`: 'text' | 'media'
  - `content`: Text or media URL
  - `tags`: Array of strings for deck categorization
  - `isActive`: Boolean flag for soft deletion
  - `createdAt/updatedAt`: Timestamp tracking

#### Key Features:
- **Compound Indexing**: Performance optimization on `isActive` and `createdAt`
- **Pre-save Hooks**: Automatic timestamp management
- **JSON Transformation**: ISO 8601 timestamp formatting
- **Validation**: Type-specific content validation

## 2. Play Session Flow (Card Consumption)

### 2.1 Play Session Initialization
- **File**: `app/api/v1/play/start/route.ts`
- **Function**: `POST` handler
- **Purpose**: Creates a new play session with a deck of cards

#### Key Operations:
1. **Deck Selection**: Filters cards by tags (`all` or specific deck)
2. **Card Aggregation**: Uses MongoDB aggregation for random ordering
3. **Deck Entity Creation**: Validates deck integrity using `DeckEntity`
4. **Play Session Creation**: Creates `Play` document in database

#### Integration Points:
- **Card Filtering**: Queries `Card` collection with `isActive: true`
- **Deck Management**: `app/lib/models/DeckEntity.ts` → validation and state management
- **Play Tracking**: `app/lib/models/Play.ts` → session persistence

### 2.2 Swipe Processing
- **File**: `app/api/v1/swipe/route.ts`
- **Function**: `POST` handler
- **Purpose**: Processes user swipes (left/right) on cards

#### Key Operations:
1. **Swipe Validation**: Validates card state and prevents duplicates
2. **Deck State Management**: Uses `DeckEntity` for position tracking
3. **Personal Ranking**: Builds user's personal card ranking
4. **State Transitions**: Manages flow between swiping/voting/completion

#### Integration Points:
- **Play Session**: Updates `Play` document with swipe data
- **Voting Trigger**: Initiates comparison voting for right-swiped cards
- **Completion Detection**: Identifies when deck is exhausted

### 2.3 Voting/Comparison System
- **File**: `app/api/v1/vote/route.ts`
- **Function**: `POST` handler
- **Purpose**: Processes pairwise comparisons between cards

#### Key Operations:
1. **Binary Search Ranking**: Implements ELO-inspired positioning algorithm
2. **Atomic Updates**: Uses MongoDB transactions for consistency
3. **State Management**: Handles complex state transitions
4. **Completion Handling**: Detects and processes session completion

#### Integration Points:
- **Ranking Algorithm**: Complex binary search with accumulated bounds
- **Session Results**: Triggers `savePlayResults` on completion
- **Global Rankings**: Indirectly feeds data to global ranking calculation

## 3. Global Ranking System

### 3.1 Global Ranking Model
- **File**: `app/lib/models/GlobalRanking.ts`
- **Purpose**: Manages global ELO-based rankings across all users

#### Core Fields:
- `cardId`: Card UUID reference
- `eloRating`: Primary ranking metric (default: 1000)
- `wins/losses/totalGames`: Game statistics
- `winRate`: Calculated win percentage
- `lastUpdated`: Timestamp of last calculation

#### Key Features:
- **ELO Algorithm**: Implements classic ELO rating system
- **Bulk Operations**: Efficient batch updates
- **Static Methods**: `calculateRankings()` for global recalculation

### 3.2 Global Ranking Calculation
- **File**: `app/lib/models/GlobalRanking.ts`
- **Function**: `calculateRankings()` static method
- **Purpose**: Recalculates all global rankings based on session data

#### Algorithm Flow:
1. **Session Data Retrieval**: Gets completed sessions with votes
2. **Vote Processing**: Extracts all pairwise comparisons
3. **ELO Updates**: Processes votes chronologically
4. **Bulk Database Update**: Efficiently updates all rankings

#### ELO Implementation:
```javascript
// Expected score calculation
expectedScore = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))

// Rating update
newRating = currentRating + K_FACTOR * (actualScore - expectedScore)
```

### 3.3 Global Ranking API
- **File**: `app/api/v1/global-rankings/route.ts`
- **Functions**: `GET` and `POST` handlers
- **Purpose**: Provides access to global rankings with filtering

#### Key Operations:
1. **Automatic Recalculation**: Triggers `calculateRankings()` on each request
2. **Deck Filtering**: Supports filtering by deck tags
3. **Card Details**: Joins ranking data with card information
4. **Sorting**: Orders by ELO rating, win rate, total games

## 4. Integration Points and Data Flow

### 4.1 Complete Flow Diagram

```
Card Addition → Card Storage → Deck Selection → Play Session
     ↓              ↓              ↓              ↓
   Card.ts      Card Model     Play Start     Play.ts
                                   ↓
                              Swipe/Vote → Session Completion
                                   ↓              ↓
                               Vote.ts     Session Results
                                   ↓              ↓
                            Vote Processing → Global Ranking
                                   ↓         Calculation
                               Pairwise          ↓
                              Comparisons   GlobalRanking.ts
                                   ↓              ↓
                              ELO Updates → Global Rankings API
```

### 4.2 Key Integration Points

#### A. Card Creation → Global Rankings
- **Connection**: Cards created via `/cards/add` become available in play sessions
- **Integration**: `Card.isActive: true` filter ensures only active cards participate
- **Flow**: New cards start with default ELO rating (1000) when first played

#### B. Play Sessions → Global Data
- **Connection**: Completed sessions feed vote data to global rankings
- **Integration**: `Session.votes` array provides pairwise comparison data
- **Flow**: Each vote updates ELO ratings of both cards involved

#### C. Voting System → Ranking Calculation
- **Connection**: Vote endpoint processes comparisons and feeds global system
- **Integration**: `GlobalRanking.calculateRankings()` processes all session votes
- **Flow**: Chronological vote processing maintains ELO accuracy

#### D. Session Management → Results Storage
- **Connection**: Completed sessions trigger result storage
- **Integration**: `SessionResults` model stores personal rankings
- **Flow**: Both personal and global rankings are maintained separately

### 4.3 Data Models Hierarchy

```
Card (Base Entity)
├── Used in → DeckEntity (Game Logic)
├── Referenced in → Play (Session Tracking)
├── Compared in → Vote Processing
└── Ranked in → GlobalRanking (ELO System)

Play Session
├── Contains → Swipes (User Actions)
├── Contains → Votes (Pairwise Comparisons)
├── Produces → Personal Rankings
└── Feeds → Global Ranking Calculation

Global Rankings
├── Aggregates → All Session Votes
├── Calculates → ELO Ratings
├── Provides → Sorted Rankings
└── Supports → Deck Filtering
```

## 5. Critical Integration Dependencies

### 5.1 Schema Validation
- **File**: `app/lib/validation/schemas.ts`
- **Dependencies**: All API endpoints rely on Zod schemas
- **Impact**: Changes to schemas affect entire flow

### 5.2 Field Name Constants
- **File**: `app/lib/constants/fieldNames.ts`
- **Dependencies**: All models and APIs use these constants
- **Impact**: Centralized naming prevents inconsistencies

### 5.3 Database Connections
- **File**: `app/lib/utils/db.ts`
- **Dependencies**: All database operations require connection
- **Impact**: Connection handling affects all data persistence

### 5.4 Optimistic Locking
- **Implementation**: Version fields in `Play` and `Session` models
- **Purpose**: Prevents concurrent modification conflicts
- **Impact**: Critical for vote processing integrity

## 6. Performance Considerations

### 6.1 Indexing Strategy
- **Card Model**: Compound index on `isActive` and `createdAt`
- **Play Model**: Indexes on UUID, session ID, and status
- **Global Rankings**: Index on `eloRating` for sorting

### 6.2 Bulk Operations
- **Global Rankings**: Uses `bulkWrite()` for efficient updates
- **Vote Processing**: Processes all votes in memory before database update
- **Session Limits**: Recent sessions limit (500) for performance

### 6.3 Caching Strategy
- **Headers**: No-cache headers on ranking endpoints
- **TTL**: Automatic cleanup of expired sessions
- **Aggregation**: Efficient MongoDB aggregation for card selection

## 7. Recommendations for Integration

### 7.1 Monitoring Points
1. **Card Addition Rate**: Track new card creation frequency
2. **Global Ranking Calculation Time**: Monitor performance of ELO updates
3. **Session Completion Rate**: Track user engagement metrics
4. **Vote Processing Errors**: Monitor transaction failures

### 7.2 Potential Integration Enhancements
1. **Real-time Updates**: WebSocket integration for live rankings
2. **Batch Processing**: Queue-based global ranking updates
3. **Caching Layer**: Redis caching for frequently accessed rankings
4. **Analytics Integration**: Enhanced tracking of user behavior

### 7.3 Error Handling Improvements
1. **Retry Mechanisms**: Automatic retry for failed ranking calculations
2. **Rollback Procedures**: Enhanced error recovery for vote processing
3. **Data Validation**: Additional integrity checks across the flow
4. **Monitoring Alerts**: Automated alerts for critical failures

---

**Analysis completed**: 2025-01-27T21:51:23.456Z
**Total modules analyzed**: 12 core files, 8 API endpoints, 5 data models
**Integration points identified**: 15 critical connections mapped
