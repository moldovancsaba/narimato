# Development Learnings

**Current Version:** 2.0.2 (Updated)
**Date:** 2025-07-29

## State Transitions  Edge Cases

### Concurrent Swipes
1. **Issue Identified**: Multiple rapid swipes could cause race conditions in state updates
2. **Resolution**: 
   - Implemented debounce (300ms) on swipe actions
   - Server-side validation ensures sequential processing
   - Duplicate swipes on same card are ignored

### Vote Phase Transitions
1. **Critical State Management**:
   - Right swipe triggers vote phase
   - First card automatically ranked and returns to swipe
   - Subsequent cards go through comparison with ranked cards
   - Smooth transition between vote and swipe phases
   - No "lost" cards during transitions

2. **Edge Cases Handled**:
   - Browser refresh during vote phase
   - Network interruption between swipe and vote
   - First card direct ranking scenario
   - Return to swipe after ranking complete
   - Duplicate vote submissions

### Swipe and Vote Component Insights
1. **Design Decision**:
   - Unified component structure for consistency in SwipeCard and VoteCard
   - Reuse of interface definitions for consistent data handling

2. **Technology Selection**:
   - Use @use-gesture/react for gesture handling to provide advanced interaction support
   - Leverage react-spring for smooth animations and visual feedback

3. **Error Handling**:
   - Implemented comprehensive error handling strategies in SwipeCard component
   - Error states are visually distinguished to enhance user perception and recovery

4. **Animation Decisions**:
   - Carefully selected animation parameters (friction, tension) for optimal responsiveness
   - Utilized Framer Motion for declarative animation states in VoteCard

### Ranking Insertions
1. **Binary Search Optimization**:
   - Efficient card insertion using binary comparison
   - Maintains ranking integrity during insertions
   - Handles edge cases (top/bottom placements)

2. **Data Consistency**:
   - Atomic updates to prevent partial rankings
   - Validation of vote chain integrity
   - Prevention of circular references

### Session Recovery
1. **Robust State Persistence**:
   - Client-side state backup (localStorage)
   - Server-side session recovery
   - Graceful handling of incomplete states

2. **Recovery Scenarios**:
   - Browser/tab closure during active session
   - Network disconnection recovery
   - Device rotation/resize during interaction
   - Memory pressure handling

### Implementation Challenges
1. **Concurrency Management**:
   - Implemented optimistic locking in session state updates
   - Addressed potential conflicts with robust retry strategies

2. **User Experience**:
   - Enhanced UI feedback loops to ensure clarity (e.g., hover effects on VoteCard)
   - Accessibility considerations integrated into keyboard event handling

3. **Performance Optimization**:
   - Optimized component re-renders with selective prop updates
   - Limited use of heavy operations in critical rendering paths

### Technical Insights
- **State Management**: Leveraged useState and useEffect hooks for fine-grained control over state and lifecycle operations.
- **Code Scalability**: Modularized components and common logic for future growth and maintenance ease.

## Implementation Details

### State Machine Implementation
```typescript
type SessionState = 
  | 'CREATED'
  | 'SWIPING'
  | 'VOTING'
  | 'COMPARING'
  | 'COMPLETE';

type StateTransition = {
  from: SessionState;
  to: SessionState;
  trigger: string;
  validation: () => boolean;
};

const stateTransitions: StateTransition[] = [
  {
    from: 'CREATED',
    to: 'SWIPING',
    trigger: 'DECK_READY',
    validation: () => deckIsValid()
  },
  {
    from: 'SWIPING',
    to: 'VOTING',
    trigger: 'RIGHT_SWIPE',
    validation: () => cardIsValid()
  },
  {
    from: 'VOTING',
    to: 'SWIPING',
    trigger: 'FIRST_CARD_RANKED',
    validation: () => noRankedCardsExist()
  },
  {
    from: 'VOTING',
    to: 'COMPARING',
    trigger: 'HAS_RANKED_CARDS',
    validation: () => hasRankedCards()
  },
  {
    from: 'COMPARING',
    to: 'COMPARING',
    trigger: 'MORE_COMPARISONS',
    validation: () => needsMoreComparisons()
  },
  {
    from: 'COMPARING',
    to: 'SWIPING',
    trigger: 'COMPARISONS_COMPLETE',
    validation: () => rankingComplete()
  },
  {
    from: 'SWIPING',
    to: 'COMPLETE',
    trigger: 'NO_MORE_CARDS',
    validation: () => allCardsProcessed()
  }
];
```

### Recovery Protocol
```typescript
interface RecoveryState {
  sessionId: string;
  lastKnownState: SessionState;
  timestamp: string; // ISO8601
  ranking: string[]; // Card UUIDs
  remainingCards: string[]; // Unprocessed cards
}

async function recoverSession(sessionId: string): Promise<void> {
  // 1. Load recovery state
  const state = await loadRecoveryState(sessionId);
  
  // 2. Validate state integrity
  if (!isStateValid(state)) {
    throw new Error('Invalid recovery state');
  }
  
  // 3. Rebuild session context
  await rebuildSessionContext(state);
  
  // 4. Resume from last known good state
  await resumeSession(state.lastKnownState);
}
