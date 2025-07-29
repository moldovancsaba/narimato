import { 
  SESSION_FIELDS, 
  CARD_FIELDS, 
  DECK_FIELDS, 
  VOTE_FIELDS, 
  VALIDATION_PATTERNS 
} from '../constants/fieldNames';

/**
 * Utility functions to validate and ensure consistent field usage
 */

export function validateUUID(value: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(value);
}

export function validateSessionId(sessionId: string): boolean {
  return VALIDATION_PATTERNS.SESSION_ID.test(sessionId);
}

/**
 * Type guard to ensure objects have required session fields
 */
export function hasSessionFields(obj: any): obj is Record<keyof typeof SESSION_FIELDS, any> {
  return obj && 
    typeof obj[SESSION_FIELDS.ID] === 'string' &&
    validateSessionId(obj[SESSION_FIELDS.ID]);
}

/**
 * Type guard to ensure objects have required card fields
 */
export function hasCardFields(obj: any): obj is Record<keyof typeof CARD_FIELDS, any> {
  return obj && 
    typeof obj[CARD_FIELDS.UUID] === 'string' &&
    validateUUID(obj[CARD_FIELDS.UUID]) &&
    ['text', 'media'].includes(obj[CARD_FIELDS.TYPE]);
}

/**
 * Ensures consistent field naming for session objects
 */
export function normalizeSessionObject(obj: any): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  // Handle common variations of session ID
  if (obj.sessionId) normalized[SESSION_FIELDS.ID] = obj.sessionId;
  if (obj.session_id) normalized[SESSION_FIELDS.ID] = obj.session_id;
  if (obj.id && validateSessionId(obj.id)) normalized[SESSION_FIELDS.ID] = obj.id;
  
  // Handle other session fields
  if (obj.sessionState) normalized[SESSION_FIELDS.STATE] = obj.sessionState;
  if (obj.version) normalized[SESSION_FIELDS.VERSION] = obj.version;
  if (obj.lastSyncTimestamp) normalized[SESSION_FIELDS.LAST_SYNC] = obj.lastSyncTimestamp;
  if (obj.createdAt) normalized[SESSION_FIELDS.CREATED_AT] = obj.createdAt;
  if (obj.updatedAt) normalized[SESSION_FIELDS.UPDATED_AT] = obj.updatedAt;
  
  return normalized;
}

/**
 * Ensures consistent field naming for card objects
 */
export function normalizeCardObject(obj: any): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  // Handle common variations of card ID
  if (obj.uuid) normalized[CARD_FIELDS.UUID] = obj.uuid;
  if (obj.cardId) normalized[CARD_FIELDS.ID] = obj.cardId;
  if (obj.card_id) normalized[CARD_FIELDS.ID] = obj.card_id;
  if (obj.id && validateUUID(obj.id)) normalized[CARD_FIELDS.UUID] = obj.id;
  
  // Handle other card fields
  if (obj.type) normalized[CARD_FIELDS.TYPE] = obj.type;
  if (obj.content) normalized[CARD_FIELDS.CONTENT] = obj.content;
  if (obj.title) normalized[CARD_FIELDS.TITLE] = obj.title;
  if (obj.tags) normalized[CARD_FIELDS.TAGS] = obj.tags;
  if (obj.isActive !== undefined) normalized[CARD_FIELDS.IS_ACTIVE] = obj.isActive;
  if (obj.createdAt) normalized[CARD_FIELDS.CREATED_AT] = obj.createdAt;
  if (obj.updatedAt) normalized[CARD_FIELDS.UPDATED_AT] = obj.updatedAt;
  
  return normalized;
}

/**
 * Creates consistent React keys for lists to avoid duplicate key issues
 */
export function createUniqueKey(prefix: string, ...identifiers: (string | number)[]): string {
  return `${prefix}_${identifiers.join('_')}`;
}

/**
 * Validates that an object follows the expected field naming conventions
 */
export function validateFieldNaming(obj: any, expectedFields: Record<string, string>): string[] {
  const errors: string[] = [];
  const objectKeys = Object.keys(obj);
  
  for (const [fieldKey, fieldName] of Object.entries(expectedFields)) {
    if (objectKeys.includes(fieldName)) continue;
    
    // Check for common variations that should be standardized
    const variations = getFieldVariations(fieldName);
    const foundVariation = variations.find(variation => objectKeys.includes(variation));
    
    if (foundVariation) {
      errors.push(`Field '${foundVariation}' should be '${fieldName}' for consistency`);
    }
  }
  
  return errors;
}

/**
 * Get common variations of field names to detect inconsistencies
 */
function getFieldVariations(fieldName: string): string[] {
  const variations: string[] = [];
  
  // Convert camelCase to snake_case
  const snakeCase = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
  if (snakeCase !== fieldName) variations.push(snakeCase);
  
  // Convert snake_case to camelCase
  const camelCase = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  if (camelCase !== fieldName) variations.push(camelCase);
  
  // Common abbreviations
  if (fieldName === 'sessionId') variations.push('session_id', 'sid');
  if (fieldName === 'cardId') variations.push('card_id', 'cid');
  if (fieldName === 'uuid') variations.push('id', 'uid');
  
  return variations;
}
