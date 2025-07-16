/**
 * Core types shared across the application
 * These types represent the fundamental data structures used throughout the system
 */

/**
 * Base model interface with common fields for all documents
 */
export interface BaseModel {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User activity types supported by the system
 * Used to track and audit user actions across the application
 */
export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'card_added'
  | 'card_removed'
  | 'collaborator_added'
  | 'collaborator_removed'
  | 'comment_added';

/**
 * Activity log entry structure
 * Used to track all changes and actions within the system
 */
export interface Activity {
  type: ActivityType;
  timestamp: Date;
  userId: string;
  details?: Record<string, any>;
}

/**
 * Visibility settings for content
 * Controls access and display of projects, cards, and other content
 */
export type Visibility = 'public' | 'private' | 'restricted';

/**
 * User role types within the system
 * Determines access levels and permissions
 */
export type UserRole = 'admin' | 'editor' | 'viewer';

/**
 * Content ordering options
 * Used for displaying lists and collections
 */
export type OrderType = 'manual' | 'date' | 'popularity' | 'alphabetical';

/**
 * Tag structure for categorization
 * Used across projects and cards for organization
 */
export interface Tag {
  name: string;
  color?: string;  // Hex color code
  description?: string;
}
