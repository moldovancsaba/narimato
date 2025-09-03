/**
 * FUNCTIONAL: TypeScript-style interface definitions for Decision Tree system
 * STRATEGIC: Provides type safety and clear contracts for all decision tree components,
 * enabling better code maintainability and preventing runtime errors
 */

/**
 * FUNCTIONAL: Represents a vote/comparison between two cards
 * STRATEGIC: Central data structure for binary search ranking algorithm
 * @typedef {Object} Vote
 * @property {string} cardA - UUID of first card
 * @property {string} cardB - UUID of second card  
 * @property {string} winner - UUID of winning card (must match cardA or cardB)
 * @property {Date} timestamp - When the vote was cast
 */

/**
 * FUNCTIONAL: Search bounds for binary search positioning
 * STRATEGIC: Enables O(log n) complexity by maintaining valid insertion range
 * @typedef {Object} SearchBounds
 * @property {number} start - Lower bound index (inclusive)
 * @property {number} end - Upper bound index (exclusive)
 * @property {boolean} collapsed - Whether bounds have converged (start >= end)
 */

/**
 * FUNCTIONAL: Context for next comparison decision
 * STRATEGIC: Guides the binary search algorithm's next comparison choice
 * @typedef {Object} ComparisonContext
 * @property {string} newCard - Card being positioned in ranking
 * @property {string} compareWith - Card to compare against
 * @property {SearchBounds} bounds - Current search space
 * @property {number} informationGain - Expected reduction in uncertainty
 */

/**
 * FUNCTIONAL: Hierarchical decision tree session configuration
 * STRATEGIC: Controls how parent-child relationships affect ranking flow
 * @typedef {Object} HierarchicalConfig
 * @property {boolean} enabled - Whether hierarchical mode is active
 * @property {string} mode - 'sequential' | 'parallel' | 'conditional'
 * @property {number} minChildrenForSession - Minimum children needed for child session (default: 2)
 * @property {boolean} preserveParentOrder - Whether to maintain parent ranking order
 */

/**
 * FUNCTIONAL: Parent card decision in hierarchical flow
 * STRATEGIC: Determines child card inclusion and ranking behavior
 * @typedef {Object} ParentDecision
 * @property {string} parentCardId - UUID of parent card
 * @property {'left'|'right'} direction - Swipe direction
 * @property {'include_children'|'exclude_children'|'no_children'} decision - Child inclusion decision
 * @property {Date} timestamp - When decision was made
 * @property {number} childrenCount - Number of child cards affected
 */

/**
 * FUNCTIONAL: Child session configuration and state
 * STRATEGIC: Manages isolated ranking sessions for child cards
 * @typedef {Object} ChildSession
 * @property {string} sessionId - Unique session identifier
 * @property {string} parentCardId - Parent card UUID
 * @property {string} parentName - Parent card name for reference
 * @property {number} parentPosition - Parent's position in ranking (1-indexed)
 * @property {string[]} childCardIds - Child cards to rank
 * @property {string[]} ranking - Current child ranking
 * @property {Vote[]} votes - Votes within this child session
 * @property {'active'|'completed'|'skipped'} status - Session state
 * @property {Date} startedAt - Session start time
 * @property {Date} completedAt - Session completion time
 */

/**
 * FUNCTIONAL: Complete hierarchical ranking result
 * STRATEGIC: Final output combining parent and child rankings in correct order
 * @typedef {Object} HierarchicalResult
 * @property {string[]} finalRanking - Complete ranking with parents and children
 * @property {Object[]} details - Breakdown of parent-child groups
 * @property {number} totalItems - Total cards in final ranking
 * @property {number} parentCount - Number of parent cards
 * @property {number} childCount - Number of child cards
 * @property {Date} completedAt - When hierarchical ranking was finalized
 */

/**
 * FUNCTIONAL: Decision tree algorithm performance metrics
 * STRATEGIC: Enables monitoring and optimization of algorithm efficiency
 * @typedef {Object} PerformanceMetrics
 * @property {number} averageComparisons - Average comparisons per card
 * @property {number} totalExecutionTime - Total time in milliseconds
 * @property {number} optimalComparisons - Theoretical minimum comparisons
 * @property {number} efficiency - Actual vs optimal performance ratio
 * @property {Object} cacheStats - Cache hit/miss statistics
 */

/**
 * FUNCTIONAL: Error context for decision tree operations
 * STRATEGIC: Provides detailed error information for debugging and recovery
 * @typedef {Object} DecisionTreeError
 * @property {string} code - Error classification code
 * @property {string} message - Human-readable error message
 * @property {Object} context - Additional error context
 * @property {boolean} recoverable - Whether error can be automatically recovered
 * @property {string[]} suggestions - Suggested recovery actions
 */

module.exports = {
  // Export types for JSDoc validation - actual runtime validation would use Zod schemas
  HIERARCHICAL_MODES: ['sequential', 'parallel', 'conditional'],
  SESSION_STATUSES: ['active', 'completed', 'skipped'],
  SWIPE_DIRECTIONS: ['left', 'right'],
  DECISION_TYPES: ['include_children', 'exclude_children', 'no_children']
};
