import mongoose, { Schema } from 'mongoose';

/**
 * Organization Model - Master Database
 * 
 * ARCHITECTURAL PURPOSE:
 * - Manages metadata and database configurations for each organization
 * - Handles organization-specific theming and branding
 * - Defines permission levels and access controls
 * - Supports custom styling and UI customization
 * 
 * SECURITY CONSIDERATIONS:
 * - Permission validation for resource access
 * - Theme injection prevention through sanitization
 * - Role-based access control enforcement
 */

const OrganizationSchema = new Schema({
  // Primary identifier
  uuid: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(uuid: string) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
      },
      message: 'UUID must be a valid UUID v4 format'
    }
  },
  
  // Organization properties
  displayName: {
    type: String,
    required: true,
    maxlength: 255,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255,
    lowercase: true,
    validate: {
      validator: function(slug: string) {
        return /^[a-z0-9-]+$/.test(slug);
      },
      message: 'Slug must contain only lowercase letters, numbers, and hyphens'
    }
  },
  description: {
    type: String,
    maxlength: 1000,
    trim: true,
    default: ''
  },
  databaseName: {
    type: String,
    required: true,
    unique: true
  },
  subdomain: {
    type: String,
    unique: true,
    sparse: true
  },
  // Theme and Branding Configuration
  theme: {
    // Primary colors
    primaryColor: {
      type: String,
      default: '#667eea',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Primary color must be a valid hex color'
      }
    },
    secondaryColor: {
      type: String,
      default: '#764ba2',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Secondary color must be a valid hex color'
      }
    },
    accentColor: {
      type: String,
      default: '#f093fb',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Accent color must be a valid hex color'
      }
    },
    backgroundColor: {
      type: String,
      default: '#0a0a0a',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Background color must be a valid hex color'
      }
    },
    textColor: {
      type: String,
      default: '#ffffff',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Text color must be a valid hex color'
      }
    },
    
    // Typography
    fontFamily: {
      type: String,
      default: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      maxlength: 255
    },
    fontSize: {
      type: String,
      default: '16px',
      validate: {
        validator: function(v: string) {
          return /^\d+(px|rem|em)$/.test(v);
        },
        message: 'Font size must be a valid CSS size value'
      }
    },
    
    // Layout and Spacing
    borderRadius: {
      type: String,
      default: '8px',
      validate: {
        validator: function(v: string) {
          return /^\d+(px|rem|em)$/.test(v);
        },
        message: 'Border radius must be a valid CSS size value'
      }
    },
    spacing: {
      type: String,
      default: '1rem',
      validate: {
        validator: function(v: string) {
          return /^\d+(\.\d+)?(px|rem|em)$/.test(v);
        },
        message: 'Spacing must be a valid CSS size value'
      }
    },
    
    // Custom CSS overrides (sanitized)
    customCSS: {
      type: String,
      maxlength: 10000,
      validate: {
        validator: function(v: string) {
          // Basic CSS injection prevention
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /expression\(/i,
            /import\s/i,
            /@import/i,
            /url\(/i
          ];
          return !dangerousPatterns.some(pattern => pattern.test(v));
        },
        message: 'Custom CSS contains potentially dangerous content'
      }
    }
  },
  
  // Branding Assets
  branding: {
    logoUrl: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          return /^https?:\/\/.+\.(jpg|jpeg|png|gif|svg|webp)$/i.test(v);
        },
        message: 'Logo URL must be a valid image URL'
      }
    },
    faviconUrl: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          return /^https?:\/\/.+\.(ico|png|jpg|jpeg|gif|svg)$/i.test(v);
        },
        message: 'Favicon URL must be a valid image URL'
      }
    },
    organizationTitle: {
      type: String,
      maxlength: 255,
      trim: true
    },
    organizationDescription: {
      type: String,
      maxlength: 1000,
      trim: true
    },
    contactEmail: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Contact email must be a valid email address'
      }
    },
    websiteUrl: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          return /^https?:\/\/.+$/i.test(v);
        },
        message: 'Website URL must be a valid URL'
      }
    }
  },
  
  // Permission System
  permissions: {
    // Default permission level for new users
    defaultRole: {
      type: String,
      enum: ['viewer', 'editor', 'admin', 'owner'],
      default: 'viewer'
    },
    
    // Feature permissions
    features: {
      canCreateCards: {
        type: Boolean,
        default: true
      },
      canEditCards: {
        type: Boolean,
        default: true
      },
      canDeleteCards: {
        type: Boolean,
        default: false
      },
      canManageUsers: {
        type: Boolean,
        default: false
      },
      canViewAnalytics: {
        type: Boolean,
        default: false
      },
      canExportData: {
        type: Boolean,
        default: false
      },
      canManageSettings: {
        type: Boolean,
        default: false
      },
      canManageThemes: {
        type: Boolean,
        default: false
      }
    },
    
    // Role-based permissions matrix
    rolePermissions: {
      viewer: {
        canCreateCards: { type: Boolean, default: false },
        canEditCards: { type: Boolean, default: false },
        canDeleteCards: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canViewAnalytics: { type: Boolean, default: false },
        canExportData: { type: Boolean, default: false },
        canManageSettings: { type: Boolean, default: false },
        canManageThemes: { type: Boolean, default: false }
      },
      editor: {
        canCreateCards: { type: Boolean, default: true },
        canEditCards: { type: Boolean, default: true },
        canDeleteCards: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canViewAnalytics: { type: Boolean, default: false },
        canExportData: { type: Boolean, default: false },
        canManageSettings: { type: Boolean, default: false },
        canManageThemes: { type: Boolean, default: false }
      },
      admin: {
        canCreateCards: { type: Boolean, default: true },
        canEditCards: { type: Boolean, default: true },
        canDeleteCards: { type: Boolean, default: true },
        canManageUsers: { type: Boolean, default: true },
        canViewAnalytics: { type: Boolean, default: true },
        canExportData: { type: Boolean, default: true },
        canManageSettings: { type: Boolean, default: true },
        canManageThemes: { type: Boolean, default: true }
      },
      owner: {
        canCreateCards: { type: Boolean, default: true },
        canEditCards: { type: Boolean, default: true },
        canDeleteCards: { type: Boolean, default: true },
        canManageUsers: { type: Boolean, default: true },
        canViewAnalytics: { type: Boolean, default: true },
        canExportData: { type: Boolean, default: true },
        canManageSettings: { type: Boolean, default: true },
        canManageThemes: { type: Boolean, default: true }
      }
    }
  },
  
  // Legacy settings (keep for backward compatibility)
  settings: {
    type: Map,
    of: String
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient lookups
OrganizationSchema.index({ uuid: 1, isActive: 1 });
OrganizationSchema.index({ slug: 1, isActive: 1 });

// Theme configuration interface
export interface IOrganizationTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
  spacing: string;
  customCSS?: string;
}

// Branding configuration interface
export interface IOrganizationBranding {
  logoUrl?: string;
  faviconUrl?: string;
  organizationTitle?: string;
  organizationDescription?: string;
  contactEmail?: string;
  websiteUrl?: string;
}

// Permission interfaces
export interface IFeaturePermissions {
  canCreateCards: boolean;
  canEditCards: boolean;
  canDeleteCards: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  canManageSettings: boolean;
  canManageThemes: boolean;
}

export interface IRolePermissions {
  viewer: IFeaturePermissions;
  editor: IFeaturePermissions;
  admin: IFeaturePermissions;
  owner: IFeaturePermissions;
}

export interface IOrganizationPermissions {
  defaultRole: 'viewer' | 'editor' | 'admin' | 'owner';
  features: IFeaturePermissions;
  rolePermissions: IRolePermissions;
}

// UUID-First Architecture: Clean Organization interface
export interface IOrganization {
  OrganizationUUID: string; // Primary identifier
  OrganizationName: string;
  OrganizationSlug: string;
  OrganizationDescription?: string;
  databaseName: string;
  subdomain?: string;
  theme?: IOrganizationTheme;
  branding?: IOrganizationBranding;
  permissions?: IOrganizationPermissions;
  settings?: Map<string, string>;
  isActive?: boolean;
  createdAt?: Date;
}

const Organization = (mongoose.models.Organization || mongoose.model<IOrganization>('Organization', OrganizationSchema));

export default Organization;

