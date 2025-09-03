# Decision Tree Service Testing Guide

**Version:** 5.1.0  
**Date:** 2025-01-09  
**Status:** Manual Testing Procedures (Tests Prohibited per Rules)

## Testing Overview

This guide provides comprehensive manual testing procedures for the refactored Decision Tree Service system. All testing must be performed manually in the development environment as automated tests are prohibited per project rules.

## Prerequisites

### Environment Setup
```bash
# Verify successful build
npm run build

# Start development server  
npm run dev

# Verify MongoDB connection
# Check .env.local has proper MONGODB_URI
```

### Required Test Data
- Organization with hierarchical cards (parents and children)
- Minimum 5 cards per deck for meaningful ranking
- Mix of parent cards with 2+ children and standalone cards

## Core Decision Tree Testing

### 1. Binary Search Algorithm Verification

#### Test Case 1.1: Basic Binary Search Ranking
**Objective**: Verify optimized binary search positions cards correctly

**Steps**:
1. Start play session with 5+ cards
2. Right swipe first card → Should go to ranking immediately
3. Right swipe second card → Should trigger voting mode
4. Make comparison votes noting search space reduction
5. Verify card positions in final ranking match vote choices

**Expected Results**:
- First card always positions at top of ranking
- Subsequent cards require O(log n) comparisons maximum
- Search bounds collapse correctly after sufficient votes
- No infinite voting loops occur

**Validation Points**:
- Console logs show bounds calculation: `calculateSearchBounds()`
- Vote count should be <= log₂(n) for optimal performance
- Cards insert at mathematically correct positions

#### Test Case 1.2: Accumulated Bounds Optimization
**Objective**: Verify algorithm uses all previous vote history

**Steps**:
1. Create ranking with 4 cards through voting
2. Add 5th card that requires positioning
3. Vote comparisons should reference previous vote constraints
4. Verify bounds narrow correctly with each vote

**Expected Results**:
- Each vote refines position bounds using historical data
- No redundant comparisons requested
- Position determination uses maximum available information

### 2. Hierarchical Flow Testing

#### Test Case 2.1: Parent-Child Session Flow
**Objective**: Verify parent completion triggers child sessions

**Steps**:
1. Start session with deck containing parent cards
2. Right swipe parent cards with 2+ children
3. Complete parent ranking (all cards swiped/voted)
4. Verify automatic transition to first child session
5. Complete child ranking for first family
6. Verify transition to next child session
7. Continue until all families ranked

**Expected Results**:
- Parent session marked as `hierarchically_completed`
- Child sessions created in parent ranking order
- Each child session isolated to sibling cards only
- Proper redirect information provided in API responses

#### Test Case 2.2: Mixed Parent/Standalone Cards
**Objective**: Test sessions with both hierarchical and non-hierarchical cards

**Steps**:
1. Create deck with:
   - 2 parent cards (each with 2+ children)  
   - 3 standalone cards (no children)
2. Complete ranking session
3. Verify only parent cards trigger child sessions
4. Verify standalone cards remain in final ranking unchanged

**Expected Results**:
- Child sessions only created for parent cards
- Final ranking maintains hierarchical structure
- Standalone cards positioned correctly among parents

### 3. API Integration Testing

#### Test Case 3.1: Vote API with New Service
**Objective**: Verify vote endpoint uses DecisionTreeService correctly

**Steps**:
1. Start voting comparison via right swipe
2. Submit vote via `/api/play/vote` endpoint
3. Monitor console logs for service delegation
4. Verify response contains all expected fields
5. Test hierarchical redirect scenarios

**Expected API Response**:
```json
{
  "success": true,
  "requiresMoreVoting": false,
  "returnToSwipe": true,
  "nextCardId": "card-uuid-123",
  "currentRanking": ["ranked-cards"],
  "completed": false,
  "hierarchical": null
}
```

#### Test Case 3.2: Swipe API with New Service  
**Objective**: Verify swipe endpoint uses DecisionTreeService correctly

**Steps**:
1. Left swipe card (should not trigger voting)
2. Right swipe card (should trigger voting or ranking)
3. Monitor service delegation in console logs
4. Verify hierarchical parent detection works
5. Test session completion scenarios

**Expected API Response**:
```json
{
  "success": true,
  "requiresVoting": true,
  "votingContext": {
    "newCard": "card-uuid",
    "compareWith": "comparison-card-uuid"
  },
  "nextCardId": "next-card-uuid",
  "completed": false
}
```

### 4. Error Handling Testing

#### Test Case 4.1: Service Error Recovery
**Objective**: Verify service handles errors gracefully

**Steps**:
1. Attempt vote with invalid parameters
2. Attempt swipe on non-existent session
3. Test network interruption scenarios
4. Verify error messages are user-friendly

**Expected Results**:
- Specific error codes for different failure types
- No session corruption during errors
- Graceful degradation where possible
- Comprehensive error logging

#### Test Case 4.2: Session State Recovery
**Objective**: Test recovery from interrupted sessions

**Steps**:
1. Start hierarchical session 
2. Complete parent ranking
3. Start child session
4. Simulate interruption (close browser tab)
5. Reload and verify state recovery

**Expected Results**:
- Session state preserved in database
- Proper recovery to last known good state
- No lost votes or rankings
- Hierarchical flow can be resumed

## Performance Verification

### Test Case 5.1: Algorithm Efficiency
**Objective**: Verify performance improvements

**Manual Verification**:
1. Monitor vote counts needed per card
2. Check comparison selection optimality
3. Verify cache hit rates in service metrics
4. Time algorithm execution for larger datasets

**Performance Baselines**:
- Card ranking should require ≤ log₂(n) + 2 votes maximum
- Cache hit rate should be >70% for repeated operations
- Response times should be <100ms for vote/swipe operations

### Test Case 5.2: Memory Management
**Objective**: Verify no memory leaks in service

**Steps**:
1. Run multiple long sessions consecutively
2. Monitor browser memory usage
3. Check for service metric cleanup
4. Verify session cleanup occurs properly

**Expected Results**:
- Memory usage remains stable over time
- Service metrics reset appropriately
- No accumulating cache bloat

## Edge Cases Testing

### Test Case 6.1: Single Card Edge Cases
**Objective**: Test minimal deck scenarios

**Steps**:
1. Test session with only 1 card
2. Test session with 2 cards
3. Test parent with only 1 child

**Expected Results**:
- Single cards rank immediately without voting
- Minimal viable sessions work correctly
- Parents with insufficient children skip child sessions

### Test Case 6.2: Complex Hierarchical Structures
**Objective**: Test deeply nested hierarchies

**Steps**:
1. Create deck with 5 parent cards, each having 3-5 children
2. Complete full hierarchical ranking
3. Verify final ranking structure
4. Check performance with larger dataset

**Expected Results**:
- All child sessions complete successfully
- Final ranking maintains hierarchical order
- Performance remains acceptable with increased complexity

## Regression Testing

### Test Case 7.1: Legacy Functionality Preservation
**Objective**: Ensure refactor doesn't break existing features

**Steps**:
1. Test simple ranking sessions (no hierarchy)
2. Test ELO global ranking updates
3. Test session completion detection
4. Verify results page displays correctly

**Expected Results**:
- All existing functionality works identically
- No user-visible changes in UI behavior
- Same ranking accuracy and consistency

## Acceptance Criteria

### ✅ **PASS Criteria**
- [ ] All binary search rankings are mathematically correct
- [ ] Hierarchical flows complete successfully end-to-end
- [ ] API responses contain all required fields
- [ ] Error handling prevents session corruption
- [ ] Performance meets or exceeds baseline requirements
- [ ] No regression in existing functionality
- [ ] Console logs provide clear operational visibility

### ❌ **FAIL Criteria**
- Any infinite voting loops
- Hierarchical sessions that don't complete
- API responses missing required fields
- Session corruption during errors
- Performance degradation vs previous version
- Broken existing functionality

## Testing Checklist

```
□ Binary search algorithm positions cards correctly
□ Hierarchical parent-child flow works end-to-end  
□ API endpoints delegate to service properly
□ Error handling prevents corruption
□ Performance meets requirements
□ Memory management works properly
□ Edge cases handled correctly
□ Legacy functionality preserved
□ Console logging provides visibility
□ Build completes successfully
□ Development server starts without errors
```

## Troubleshooting Common Issues

### Issue: Infinite Voting Loops
**Symptoms**: Vote requests continue without card insertion
**Diagnosis**: Check bounds calculation in console logs
**Resolution**: Verify vote history includes all previous votes for card

### Issue: Hierarchical Flow Not Starting  
**Symptoms**: Parent completion doesn't trigger child sessions
**Diagnosis**: Check parent card `isParent` field and child count
**Resolution**: Verify parent cards have sufficient children (≥2)

### Issue: API Response Missing Fields
**Symptoms**: Frontend can't process API response
**Diagnosis**: Check service method return structure
**Resolution**: Verify service response matches expected API contract

### Issue: Session State Corruption
**Symptoms**: Session becomes unrecoverable
**Diagnosis**: Check error logs for service exceptions
**Resolution**: Verify all service operations have proper error handling

---

**Note**: This manual testing approach ensures comprehensive validation while respecting the project rule prohibiting automated tests. Each test case should be executed thoroughly and results documented for verification.
