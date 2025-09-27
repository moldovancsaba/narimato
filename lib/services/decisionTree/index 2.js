/**
 * FUNCTIONAL: Decision Tree Service Module Index
 * STRATEGIC: Provides clean, organized imports for all decision tree components,
 * making it easy for API endpoints and other services to access functionality
 */

const DecisionTreeService = require('./DecisionTreeService');
const BinarySearchEngine = require('./BinarySearchEngine');
const HierarchicalManager = require('./HierarchicalManager');
const SessionFlowController = require('./SessionFlowController');
const types = require('./types');

module.exports = {
  // Main service class (for instantiation)
  DecisionTreeService: DecisionTreeService,
  
  // Individual component classes (for custom instantiation if needed)
  BinarySearchEngine,
  HierarchicalManager,
  SessionFlowController,
  
  // Type definitions and constants
  types
};
