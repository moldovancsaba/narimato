/**
 * User role enumeration defining possible access levels
 */
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin'
}

/**
 * User session interface defining the structure of session data
 */
export interface UserSession {
  id: string;                    // Session UUID
  userId?: string;              // Optional - only present for authenticated users
  role: UserRole;               // Current session role
  createdAt: string;            // ISO 8601 timestamp with milliseconds
  lastAccessedAt: string;       // ISO 8601 timestamp with milliseconds
  isAnonymous: boolean;         // Whether this is an anonymous session
  preferences?: UserPreferences; // Optional user preferences
}

/**
 * User preferences interface for storing user-specific settings
 */
export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  notifications?: boolean;
  [key: string]: any;  // Allow for extensible preferences
}

/**
 * User interface defining the structure of a user document
 */
export interface User {
  id: string;           // User UUID
  role: UserRole;       // User's role
  email?: string;       // Optional email for authenticated users
  username?: string;    // Optional username for authenticated users
  preferences: UserPreferences;
  createdAt: string;    // ISO 8601 timestamp with milliseconds
  updatedAt: string;    // ISO 8601 timestamp with milliseconds
}
