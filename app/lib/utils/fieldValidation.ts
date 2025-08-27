import { 
  COMMON_FIELDS,
  CARD_FIELDS, 
  VOTE_FIELDS, 
  VALIDATION_PATTERNS,
} from '../constants/fieldNames';

/**
 * STANDARDIZED UUID VALIDATION UTILITIES - NO ALIASES ALLOWED
 * All validation functions use the uniform UUID field naming convention.
 */

export function validateUUID(value: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(value);
}

// Legacy function - use validateUUID instead for SessionUUID
export function validateSessionId(sessionId: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(sessionId);
}

// STANDARDIZED UUID VALIDATION
export function validateSessionUUID(SessionUUID: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(SessionUUID);
}

export function validatePlayUUID(PlayUUID: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(PlayUUID);
}

export function validateCardUUID(CardUUID: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(CardUUID);
}

export function validateDeckUUID(DeckUUID: string): boolean {
  return VALIDATION_PATTERNS.UUID.test(DeckUUID);
}

/**
 * Type guard to ensure objects have required session fields
 */
export function hasSessionFields(obj: any): boolean {
  return obj && 
    typeof obj.sessionUUID === 'string' &&
    validateSessionId(obj.sessionUUID);
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
  if (obj.sessionId) normalized.sessionUUID = obj.sessionId;
  if (obj.session_id) normalized.sessionUUID = obj.session_id;
  if (obj.id && validateSessionId(obj.id)) normalized.sessionUUID = obj.id;
  
  // Handle other session fields
  if (obj.sessionState) normalized.state = obj.sessionState;
  if (obj.version) normalized.version = obj.version;
  if (obj.lastSyncTimestamp) normalized.lastSync = obj.lastSyncTimestamp;
  if (obj.createdAt) normalized.createdAt = obj.createdAt;
  if (obj.updatedAt) normalized.updatedAt = obj.updatedAt;
  
  return normalized;
}

/**
 * Ensures consistent field naming for card objects
 */
export function normalizeCardObject(obj: any): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  // Handle common variations of card ID
  if (obj.uuid) normalized[CARD_FIELDS.UUID] = obj.uuid;
  if (obj.cardId) normalized[CARD_FIELDS.UUID] = obj.cardId;
  if (obj.card_id) normalized[CARD_FIELDS.UUID] = obj.card_id;
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
