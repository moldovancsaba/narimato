/**
 * FUNCTIONAL: UUID Field Name Standardization Constants
 * STRATEGIC: Ensures consistent field naming across all database operations,
 * preventing bugs from field name variations and improving maintainability
 */

/**
 * FUNCTIONAL: Standardized field names for UUID identifiers
 * STRATEGIC: Centralized definition prevents inconsistent naming like
 * sessionId vs SessionUUID vs uuid etc. across the codebase
 */
const fieldNames = {
  // Organization identifiers
  OrganizationUUID: 'organizationId',
  
  // Session identifiers  
  SessionUUID: 'uuid',
  PlayUUID: 'uuid',
  
  // Card identifiers
  CardUUID: 'uuid',
  
  // Deck identifiers
  DeckUUID: 'deckTag',
  
  // User identifiers (when implemented)
  UserUUID: 'userId',
  
  // Hierarchical identifiers
  ParentCardUUID: 'parentCardId',
  ChildSessionUUID: 'childSessionId',
  ParentSessionUUID: 'parentSessionId'
};

/**
 * FUNCTIONAL: Validation helper for field name consistency
 * STRATEGIC: Runtime validation to catch field name inconsistencies
 * 
 * @param {string} proposedFieldName - Field name to validate
 * @param {string} context - Context for error messaging
 * @returns {boolean} Whether field name is valid
 */
function validateFieldName(proposedFieldName, context = 'unknown') {
  const validFieldNames = Object.values(fieldNames);
  const isValid = validFieldNames.includes(proposedFieldName);
  
  if (!isValid) {
    console.warn(`Invalid field name "${proposedFieldName}" in context: ${context}`);
    console.warn(`Valid field names:`, validFieldNames);
  }
  
  return isValid;
}

/**
 * FUNCTIONAL: Get standardized field name for a given UUID type
 * STRATEGIC: Programmatic access to correct field names
 * 
 * @param {string} uuidType - Type of UUID (Organization, Session, Card, etc.)
 * @returns {string} Standardized field name
 */
function getFieldName(uuidType) {
  const key = `${uuidType}UUID`;
  return fieldNames[key] || 'uuid'; // fallback to generic uuid
}

module.exports = {
  fieldNames,
  validateFieldName,
  getFieldName
};
