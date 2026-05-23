# NARIMATO Architecture

**Current Version:** 7.2.0  
**Last Updated:** 2026-05-23T00:00:00.000Z

> **Canonical spec:** [narimato_unified_documentation.md](./narimato_unified_documentation.md)  
> Aspirational sections below (TypeScript paths, Session model, theming, literal `*UUID` DB columns) are **outdated** unless marked otherwise. See [docs/FUTURE.md](./docs/FUTURE.md).

## Field naming (`lib/constants/fieldNames.js`)

Constants such as `OrganizationUUID` and `PlayUUID` are **logical names**; MongoDB fields use conventional keys:

| Constant | MongoDB field | Usage |
|----------|---------------|--------|
| `OrganizationUUID` | `organizationId` | Tenant scope on cards and plays |
| `PlayUUID` / `SessionUUID` | `uuid` | Play session document id |
| `CardUUID` | `uuid` | Card document id |
| `DeckUUID` | `deckTag` | Hashtag deck selector |

There is no separate `Session` collection — session state lives on `Play` and mode-specific play models.

## Multi-tenant data (v7.2)

- **Master DB** (`MONGODB_URI`): `organizations`, `users`, `pagepasswords`, `playsessionindexes`
- **Per-org DB** (`databaseName` on org, or org `uuid`): `cards`, `plays`, `swipeonlyplays`, etc.
- **Routing:** `withOrganization(organizationId)` and `withPlayOrganization(playId)` in `lib/tenantContext.js` / `lib/api/playRoute.js`
- **ADR:** [docs/adr/002-multi-tenant-database.md](./docs/adr/002-multi-tenant-database.md)

## System Overview

- Results Page Alignment (v7.0.0)

- Interactions (v7.1.0)
  - Swipe: 50% width threshold; snap-back under threshold; complete over threshold; pointer events for mouse drag; 180ms ease-out transitions; slight rotation while dragging.
  - Vote: Safe tap only (movement < 10px) to register vote; prevents accidental votes during small drags.
  - CSS: touch-action: pan-y on game cards to avoid horizontal browser panning.
  - Role: Present side-by-side comparison of personal and global rankings for a given deck
  - Desktop strategy:
    - Personal (left) column content right-aligned; Global (right) column content left-aligned — both close to center
    - Header titles biased toward center (Personal right, Global left)
    - Inter-column gap set to 1rem
    - Equalized per-row card heights; info blocks aligned independently of card content
    - Flush-align card boxes to center edge using align-self and auto margins
  - Mobile strategy:
    - Columns stack, centered; titles centered
  - Dependencies: styled-jsx in pages/results.js; public/styles/cards.css for base card system

NARIMATO is a comprehensive card ranking application featuring advanced content management capabilities. Built with Next.js, MongoDB, and sophisticated UI components, it provides a complete ecosystem for card creation, editing, and ranking with features including smart hashtag management, deck organization, and real-time collaborative ranking.

## Flow Diagrams

### 1. Session Lifecycle
```mermaid
graph TD
    A[Start] --> B[Session Creation]
    B -- C[Hashtag-Based Selection]
    C --> D[Swipe Phase]
    D --> |Left Swipe| D
    D --> |Right Swipe| E[Vote Phase]
    E --> |First Card| F[Initial Ranking]
    F --> D
    E --> |Subsequent Cards| G[Compare with Ranked]
    G --> H{User Selection}
    H --> |Selected Card A| I[Update Ranking]
    H --> |Selected Card B| I
    I --> |More Cards to Compare| G
    I --> |Return to Swipe| D
    D --> |No More Cards| J[Session End]
    J --> K[Update Global Ranking]
```

### 2. State Transitions
```mermaid
stateDiagram-v2
    [*] --> SessionCreated
    SessionCreated --> SwipePhase: Initialize Deck
    SwipePhase --> VotePhase: Right Swipe
    VotePhase --> SwipePhase: First Card Ranked
    VotePhase --> ComparisonPhase: Has Ranked Cards
    ComparisonPhase --> RankingUpdate: Card Selection
    RankingUpdate --> ComparisonPhase: More Comparisons
    RankingUpdate --> SwipePhase: Return to Swipe
    SwipePhase --> SessionComplete: No More Cards
    SessionComplete --> [*]
    
    state SwipePhase {
        [*] --> Swiping
        Swiping --> LeftDiscard: Left Swipe
        Swiping --> RightKeep: Right Swipe
        LeftDiscard --> Swiping
        RightKeep --> Swiping
    }
    
    state ComparisonPhase {
        [*] --> ShowCards
        ShowCards --> Selection: Display Comparison
        Selection --> RankInsertion: User Chooses
        RankInsertion --> ShowCards: Next Comparison
        RankInsertion --> [*]: No More Comparisons
    }
```

### 3. Error Handling Flow
```mermaid
flowchart TD
    A[API Request] --> B{Validate Request}
    B -->|Invalid| C[Return 400 Error]
    B -->|Valid| D{Check Session}
    D -->|Not Found| E[Return 404 Error]
    D -->|Expired| F[Return 408 Timeout]
    D -->|Found| G{Optimistic Lock}
    G -->|Lock Failed| H[Return 409 Conflict]
    G -->|Lock Success| I[Process Operation]
    I -->|Success| J[Update State]
    I -->|Error| K{Error Type}
    K -->|Network| L[Retry with Backoff]
    K -->|Validation| M[Return 400 Error]
    K -->|Concurrency| N[Rollback & Retry]
    K -->|System| O[Return 500 Error]
    J --> P[Release Lock]
    L --> I
    N --> G
    P --> Q[Return Success]
```

### 4. Data Flow Architecture
```mermaid
flowchart LR
    Client[Client Browser] --> API[Next.js API Routes]
    API --> Validation[Request Validation]
    Validation --> Session[Session Management]
    Session --> DB[(MongoDB)]
    Session --> State[State Machine]
    State --> Ranking[Ranking Engine]
    Ranking --> Audit[Audit Trail]
    Audit --> Response[API Response]
    Response --> Client
    
    subgraph "Error Recovery"
        LocalStorage[Local Storage Backup]
        ErrorLog[Error Logging]
        Recovery[Auto Recovery]
    end
    
    Client -.-> LocalStorage
    API -.-> ErrorLog
    ErrorLog -.-> Recovery
    Recovery -.-> Session
```

## Theming

> **Not implemented in v7.2.** Application-wide dark mode, Tailwind theme toggles, and organization-level theming are described in older docs only. See [docs/FUTURE.md](./docs/FUTURE.md).

## System Components

### Core API Endpoints

New components (v6.4.0):
- `lib/services/RankMoreEngine.js` — orchestrates hierarchical multi-level ranking using Rank-Only segments per family
- `lib/models/RankMorePlay.js` — persistence model for Rank-More orchestration
- **Play (Unified)**:
  - `POST /api/v1/play/start`
  - `POST /api/v1/play/{playId}/input`
  - `GET /api/v1/play/{playId}/next`
  - `GET /api/v1/play/{playId}/results`
  - `GET /api/v1/play/{playId}/meta` (tenant lookup via `PlaySessionIndex`)
- **Card Management**: `/api/cards`, `/api/cards/[uuid]`, `/api/cards/rankings`
- **System Utilities**: as existing (rate limiting, middleware)

Note: Legacy endpoints under `/api/swipe-only/*`, `/api/swipe-more/*`, and `/api/vote-only/*` have been removed. All modes are routed via the unified Play dispatcher.

## Analytics Integration (v5.6.0)

- FUNCTIONAL: GA4 integrated for SPA pageviews and gameplay events
- STRATEGIC: Privacy-first, production-only analytics with Consent Mode v2

Components:
- `/lib/analytics/ga.js` — helper functions: `pageview`, `event`, consent helpers; guards for `isProd` and `GA_ID`
- `pages/_app.js` — loads GA script with `next/script`, initializes Consent Mode (default denied), and tracks pageviews on router changes

Events:
- `play_start`, `swipe_action`, `vote_cast`, `segment_end`, `play_complete`, `results_view`

Consent:
- Defaults to denied; toggle via `window.NARIMATO_setAnalyticsConsent(true|false)`
- IP anonymization enabled on all hits

CSP considerations (if/when enforced):
- script-src: https://www.googletagmanager.com https://www.google-analytics.com
- connect-src/img-src: https://www.google-analytics.com (and region endpoints)

### Play Modes (v6.4.0)

Last Updated: 2025-09-07T11:34:45.000Z

- Swipe-Only (building block)
  - Flow: present all cards one-by-one for left/right decisions; right = like (ranked by first-like order), left = reject.
  - Start returns: playId, cards[], currentCardId.
  - Input: action='swipe', payload={ cardId, direction }.
  - Next: current card context or completed.
  - Results: ranking of liked cards in swipe order, plus stats.

- Vote-Only (building block)
  - Flow: UNRANKED → choose 2 → user seeds ranking; then for each CHALLENGER from UNRANKED append to end of PERSONAL and compare against a random opponent from RANKED; prune RANKED based on winner/loser rule; continue until TEMP pool empties; repeat until UNRANKED empty.
  - Ensures correct pruning rules (delete opponent and worse/better from temporary RANKED) and moves CHALLENGER accordingly.
  - Start returns: playId, cards[], initial comparison; Input uses action='vote'.
  - Next: next challenger/opponent or completed.
  - Results: ranking (rich objects) and personalRanking (IDs), plus stats.

- Swipe-More (composed from Swipe-Only)
  - Orchestrates multiple Swipe-Only "family" segments: root family → children of liked parents → grandchildren, etc.
  - Engine maintains familiesToProcess queue, currentFamilyIndex, and activeSwipeOnlySession.
  - Each completed family appends its liked results (with context) into combinedRanking; enqueues child families for liked parents with children.
  - Optional tie-break comparisons supported via action='vote' during the flow.
  - Results: combinedRanking with family context and a family breakdown.

See docs/API_REFERENCE.md for detailed request/response examples for all modes using the unified endpoints.

- Rank-Only (composed from Swipe-Only + Vote-Only)
  - Flow: Swipe to shortlist, then vote-only to order liked cards; server signals requiresVoting to switch phases.
  - Start returns: initial swipe deck; input uses action='swipe' until switch to action='vote'.
  - Results: personalRanking of liked cards in voted order; statistics.

- Rank-More (orchestrated Rank-Only per family)
  - Flow: Rank-Only at roots, then for each liked parent with children run Rank-Only on its children; families processed in random order within each level.
  - Branch Exclusion: Disliked children exclude their entire branch.
  - Transitions: Engine may return `{ returnToSwipe, nextCardId, cards }` to switch back to swiping a new family.
  - Results: flattened list only — parent followed by ranked descendants (depth-first).

### Database models (v7.2 — matches `lib/models/`)

| Model | Database | Role |
|-------|----------|------|
| `Organization` | Master | Tenant registry; `uuid`, `slug`, `databaseName`, `settings` |
| `PlaySessionIndex` | Master | Maps `playId` → `organizationId` for cross-tenant play routes |
| `User` | Master | Admin users (`pages/api/admin/login.js`) |
| `PagePassword` | Master | Legacy page passwords (API returns 410; schema retained) |
| `Card` | Per-org | Cards, hashtags, hierarchy, **global ELO** (`globalScore`, `voteCount`, `winCount`) |
| `Play` | Per-org | Classic / hierarchical decision-tree sessions |
| `SwipeOnlyPlay` | Per-org | Unified v1 `swipe_only` persistence |
| `SwipeMorePlay` | Per-org | Unified v1 `swipe_more` |
| `VoteMorePlay` | Per-org | Unified v1 `vote_more` |
| `RankOnlyPlay` | Per-org | Unified v1 `rank_only` |
| `RankMorePlay` | Per-org | Unified v1 `rank_more` |

**Dual persistence:** `PlayDispatcher` resolves `playId` via `PlaySessionIndex`, then loads the mode-specific model (`SwipeOnlyPlay`, etc.) or legacy `Play` for `/api/play/*` classic flows. Personal rankings are stored on the active play document (`personalRanking`, mode-specific fields) — not a separate `PersonalRanking` collection.

**Global rankings:** Computed from `Card.globalScore` (ELO in `lib/utils/ranking.js`), not a `GlobalRanking` collection. See [docs/RANKING_ALGORITHMS.md](./docs/RANKING_ALGORITHMS.md).

**Planned but not implemented:** `Session`, `GlobalRanking`, `FontPreset`, `BackgroundPreset`, org theming — [docs/FUTURE.md](./docs/FUTURE.md).

**Decks:** Logical grouping (parent `#hashtag` card + children), not a MongoDB collection.

### Deck Playability Rules
- **Minimum Card Threshold**: `DECK_RULES.MIN_CARDS_FOR_PLAYABLE = 2` (in `lib/constants/fieldNames.js`)
- **Purpose**: Ensures meaningful ranking experiences by requiring at least 2 cards for comparison
- **Implementation**: Enforced in cardHierarchy.ts filtering logic, cards API responses, and play start API validation
- **User Experience Impact**: Prevents single-card deck sessions that provide no ranking/comparison opportunities

### Frontend Components
- **SwipeCard**: Interactive swipe interface with advanced gesture support and real-time animations
- **VoteCard**: Comparison voting interface
- **CardEditor**: Comprehensive card creation and editing interface with live preview
- **HashtagEditor**: Smart hashtag management with predictive suggestions and keyboard navigation
- **CardManagement**: Deck-card association interface for organizing content
- **DeckEditor**: Complete deck creation and management system
- **ErrorBoundary**: Comprehensive error handling and recovery

## Swipe Animation Architecture

### Overview
NARIMATO's swipe animation system provides sophisticated real-time visual feedback through a combination of advanced gesture detection and physics-based animations. The architecture prioritizes performance, cross-platform compatibility, and user experience.

### Core Technologies

#### @use-gesture/react (v10.3.1)
- **Purpose**: Advanced gesture recognition and handling
- **Capabilities**: Mouse, touch, and pointer event unification
- **Features**: Velocity calculation, direction detection, threshold management
- **Performance**: Optimized event handling with minimal overhead

#### @react-spring/web (v9.7.3)
- **Purpose**: Physics-based animation system
- **Features**: Spring animations, GPU acceleration, smooth interpolation
- **Configuration**: Customizable tension, friction, and animation curves
- **Performance**: Hardware-accelerated transforms for 60fps animations

### Animation Flow

```mermaid
flowchart TD
    A[User Input] --> B{Input Type}
    B -->|Mouse| C[Mouse Drag Handler]
    B -->|Touch| D[Touch Gesture Handler]
    B -->|Keyboard| E[Keyboard Handler]
    
    C --> F[useDrag Hook]
    D --> F
    E --> G[Direct Animation]
    
    F --> H[Calculate Transform]
    G --> H
    
    H --> I[React Spring Animation]
    I --> J[GPU-Accelerated Transform]
    J --> K[Visual Feedback]
    
    H --> L{Threshold Check}
    L -->|Met| M[Trigger Swipe Action]
    L -->|Not Met| N[Return to Center]
    
    M --> O[State Update]
    N --> I
```

### Gesture Detection System

#### Unified Input Handling
```typescript
const bind = useDrag(({ active, movement: [mx], direction: [xDir], velocity: [vx] }) => {
  // Unified handling for mouse and touch inputs
  const trigger = Math.abs(mx) > innerWidth * 0.2; // 20% threshold
  const isGone = !active && trigger;
  
  // Calculate transform values
  const x = isGone ? (200 + window.innerWidth) * xDir : active ? mx : 0;
  const rot = mx / 100 + (isGone ? xDir * 10 * vx : 0);
  const scale = active ? 1.1 : 1;
  
  // Apply animations
  api.start({ x, rot, scale, config: { /* optimized settings */ } });
});
```

#### Threshold Configuration
- **Swipe Trigger**: 20% of screen width for consistent experience across devices
- **Velocity Sensitivity**: Rotation and scaling based on drag velocity
- **Adaptive Behavior**: Responsive to different screen sizes and orientations

### Animation Configuration

#### Spring Physics
```typescript
const [{ x, y, scale, rot }, api] = useSpring(() => ({
  x: 0,        // Horizontal position
  y: 0,        // Vertical position (reserved)
  scale: 1,    // Card scaling factor
  rot: 0,      // Rotation angle
  config: { 
    tension: 300,  // Spring responsiveness
    friction: 20   // Movement damping
  }
}));
```

#### Performance Optimizations
- **GPU Acceleration**: Using transform properties (translateX, rotateZ, scale)
- **Efficient Updates**: Minimal DOM manipulation through React Spring
- **Memory Management**: Proper cleanup of animation resources
- **Event Throttling**: Optimized event handling to prevent excessive updates

### Cross-Platform Compatibility

#### Desktop Experience
- **Mouse Events**: Full mouse drag support with cursor state feedback
- **Keyboard Support**: Arrow key navigation with smooth animations
- **Visual Feedback**: Cursor changes (grab/grabbing) for intuitive interaction

#### Mobile Experience
- **Touch Events**: Native touch gesture support
- **Prevent Scrolling**: Touch action none to prevent page scrolling conflicts
- **Responsive Thresholds**: Adaptive swipe detection based on device characteristics

#### Tablet Support
- **Orientation Handling**: Consistent behavior in portrait and landscape modes
- **Touch Target Optimization**: Appropriate touch areas for different screen sizes
- **Performance Scaling**: Animations maintain quality across different hardware

### State Management Integration

#### Animation State Synchronization
```typescript
const handleSwipeAction = useCallback((direction: 'left' | 'right') => {
  // Prevent concurrent operations
  if (swipeState !== 'idle' || swipeLock) {
    console.warn('Concurrent swipe detected');
    return;
  }
  
  // Update application state
  setSwipeDirection(direction);
  setSwipeState('swiping');
  setSwipeLock(true);
  
  // Process swipe with error recovery
  onSwipe(direction)
    .then(() => setSwipeState('voted'))
    .catch(() => {
      // Reset animation and state
      api.start({ x: 0, rot: 0, scale: 1 });
      setSwipeState('error');
    });
}, [swipeState, swipeLock, onSwipe, api]);
```

#### Concurrent Operation Prevention
- **State Locking**: Prevents multiple simultaneous swipe operations
- **Animation Coordination**: Ensures animations don't conflict with state changes
- **Error Recovery**: Automatic reset of both animation and application state

### Performance Metrics

#### Animation Performance
- **Frame Rate**: Consistent 60fps across all supported devices
- **Input Latency**: Sub-16ms response time for touch/mouse inputs
- **Memory Usage**: Minimal overhead through efficient resource management
- **CPU Usage**: GPU-accelerated animations reduce main thread blocking

#### Optimization Strategies
- **Transform-Only Animations**: Avoiding layout-triggering properties
- **Event Pooling**: Efficient event handler management
- **Component Memoization**: React.memo and useCallback for render optimization
- **Resource Cleanup**: Proper disposal of event listeners and animation resources

### Error Handling

#### Gesture Conflicts
- **Prevention**: Removed conflicting gesture libraries (react-swipeable)
- **Detection**: Runtime detection of concurrent gesture attempts
- **Recovery**: Automatic state reset and user notification

#### Animation Failures
- **Fallback Behavior**: Graceful degradation when animations fail
- **Error Logging**: Comprehensive logging for debugging and monitoring
- **User Feedback**: Clear visual indicators for error states

### Accessibility

#### Keyboard Navigation
- **Arrow Key Support**: Full keyboard navigation with smooth animations
- **Visual Feedback**: Consistent animation behavior for keyboard interactions
- **Screen Reader**: Proper state announcements during swipe operations

#### Motion Preferences
- **Reduced Motion**: Respect for user's motion preference settings
- **Customizable Animation**: Future support for animation speed controls
- **High Contrast**: Animations work well with high contrast modes

### Future Enhancements

#### Planned Improvements
- **Haptic Feedback**: Integration with device haptic systems
- **Multi-Touch Gestures**: Advanced gesture recognition for power users
- **Customizable Animations**: User-configurable animation preferences
- **Analytics Integration**: Gesture pattern analysis for UX improvements

#### Technical Roadmap
- **WebGL Animations**: Explore WebGL for even more sophisticated effects
- **PWA Integration**: Enhanced animations for Progressive Web App experience
- **Performance Monitoring**: Real-time animation performance analytics
- **Accessibility Enhancements**: Advanced accessibility features for gesture interactions
nsive error handling and recovery

## Error Handling Procedures

### 1. Request Validation Errors (400)
**Trigger**: Invalid request format, missing fields, type mismatches

**Handling**:
- Immediate rejection with detailed error messages
- Client-side form validation to prevent submission
- Zod schema validation for type safety

**Recovery**:
- User corrects input based on error messages
- No server-side state changes occur

### 2. Session Errors (404/408)
**Trigger**: Session not found, expired, or invalid state

**Handling**:
- Session validation before any operations
- Automatic session cleanup via TTL indexes
- Client-side session state backup

**Recovery**:
- Attempt session recovery from localStorage
- Create new session if recovery fails
- Preserve user progress where possible

### 3. Concurrency Conflicts (409)
**Trigger**: Optimistic locking failures, concurrent modifications

**Handling**:
- Version-based optimistic locking on all updates
- Automatic rollback on conflicts
- Exponential backoff retry strategy

**Recovery**:
- Automatic retry with fresh session data
- User notified only if repeated failures occur
- State synchronization before retry attempts

### 4. Network/System Errors (500/503)
**Trigger**: Database unavailable, server overload, system failures

**Handling**:
- Comprehensive error logging with context
- Circuit breaker pattern for external services
- Graceful degradation where possible

**Recovery**:
- Automatic retry with exponential backoff
- Fallback to cached data when available
- User notification for persistent failures

### 5. Client-Side Error Recovery
**Local Storage Backup**:
- Automatic session state backup on each operation
- Recovery state validation before restoration
- Cleanup of expired backup data

**Error Logging**:
- Structured error logging with timestamps
- Error categorization for targeted recovery
- Performance impact monitoring

**Auto Recovery**:
- Session state synchronization on page load
- Automatic retry for transient failures
- User-initiated recovery options

## Binary Search Ranking System

### Algorithm Overview
NARIMATO implements a sophisticated binary search algorithm for optimal card positioning with O(log n) complexity.

### Key Components
- **Accumulated Search Bounds**: Each vote refines the search space for a card's final position
- **Automatic Position Detection**: System detects when search bounds collapse (start >= end)
- **Smart Comparison Selection**: Always compares against the middle card in current search space
- **State Synchronization**: Perfect alignment between frontend and backend session states

### Search Bounds Calculation
```typescript
function calculateSearchBounds(targetCard: string, ranking: string[], votes: Vote[]): Bounds {
  let start = 0, end = ranking.length;
  
  for (const vote of votes) {
    if (vote.winner === targetCard) {
      // Card ranks higher - narrow upper bound
      end = Math.min(end, ranking.indexOf(vote.loser));
    } else {
      // Card ranks lower - narrow lower bound  
      start = Math.max(start, ranking.indexOf(vote.winner) + 1);
    }
  }
  
  return { start, end };
}
```

### Performance Benefits
- ~40% reduction in average comparisons per card
- Automatic position determination eliminates unnecessary user interactions
- Efficient database updates through atomic operations
- Enhanced user experience with faster ranking completion

## State Management

## Session States
- **swiping**: User browsing and swiping cards
- **voting**: User comparing cards for ranking
- **comparing**: System performing binary search ranking
- **completed**: All cards processed, session finished

### State Transition Rules
1. **swiping → voting**: Right swipe on card
2. **voting → comparing**: Card needs comparison with existing ranking
3. **comparing → comparing**: More comparisons needed for positioning
4. **comparing → swiping**: Card positioned, return to deck
5. **swiping → completed**: No more cards in deck

### Validation Requirements
- State changes must follow defined transition matrix
- All state changes require session lock acquisition
- Rollback capability for failed transitions
- Audit trail for all state modifications

## Performance Considerations

### Database Optimization
- Indexed fields: sessionId, status, state, version, timestamps
- TTL indexes for automatic session cleanup
- Optimistic locking to minimize lock contention
- Connection pooling for database efficiency

### Client-Side Performance
- Debounced user interactions (300ms)
- Optimistic UI updates with rollback
- Efficient re-rendering with React state management
- Progressive loading for large card sets

### Caching Strategy
- No-cache headers for real-time data
- Client-side caching for static content
- Session state caching in localStorage
- Error log rotation to prevent storage overflow
