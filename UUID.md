# UUID-Centric Architecture Standard

**Current Version:** 4.0.0-UUID-REFACTOR  
**Date:** 2025-08-04T15:26:36.000Z  
**Author:** AI Development Agent  

## 🎯 Executive Summary

This document establishes the **UUID-First Architecture** standard for the Narimato application. All entity references, API operations, database queries, and frontend interactions must use UUIDs as the single source of truth. This eliminates confusion between slugs, IDs, and other identifiers, ensuring consistent data integrity and system reliability.

---

## 🏗️ Core Principles

### 1. Single Source of Truth
- **UUIDs are the ONLY authoritative identifier** for all entities
- All CRUD operations must reference entities by UUID
- Database queries must use UUID fields for lookups
- Frontend navigation and state management must use UUIDs

### 2. UUID Field Naming Convention
Each entity has a dedicated, consistently named UUID field:
- `OrganizationUUID` for Organization entities
- `CardUUID` for Card entities  
- `UserUUID` for User entities
- `PlayUUID` for Play entities
- `SessionUUID` for Session entities

### 3. Immutable Identifiers
- **UUIDs are NEVER editable** after entity creation
- UUIDs are generated using UUID v4 format
- All other properties (names, slugs, descriptions) are editable
- UUID uniqueness is enforced at database level

---

## 📊 Entity Architecture

### Organization Entity
```typescript
interface IOrganization {
  // 🔑 Primary Identifier (IMMUTABLE)
  OrganizationUUID: string; // UUID v4 format
  
  // 📝 Editable Properties
  OrganizationName: string; // Any content, including emojis (max 255 chars)
  OrganizationSlug: string; // URL-safe format only (a-z, 0-9, hyphens)
  OrganizationDescription: string; // Any content, including emojis (max 1000 chars)
  
  // 🔧 System Properties
  databaseName: string; // MongoDB database identifier
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // 🎨 Configuration Objects
  theme: IOrganizationTheme;
  branding: IOrganizationBranding;
  permissions: IOrganizationPermissions;
}
```

#### Migration Strategy for Organization
```typescript
// BEFORE (current state)
{
  name: "Default Organization",
  slug: "default-org", // ❌ Used as identifier
  databaseName: "narimato"
}

// AFTER (UUID-centric)
{
  OrganizationUUID: "550e8400-e29b-41d4-a716-446655440000", // ✅ Primary identifier
  OrganizationName: "Default Organization 🏢",
  OrganizationSlug: "default-org", // ✅ Editable URL property
  OrganizationDescription: "Default organization for Narimato ranking system",
  databaseName: "narimato"
}
```

### Card Entity
```typescript
interface ICard {
  // 🔑 Primary Identifier (IMMUTABLE)
  CardUUID: string; // UUID v4 format
  
  // 📝 Editable Properties
  CardName: string; // Hashtag format (#example)
  CardTitle: string; // Display title
  CardDescription: string; // Optional description
  
  // 🎯 Content Structure
  body: {
    imageUrl?: string;
    textContent?: string;
    background?: IBackgroundStyle;
  };
  
  // 🏷️ Relationships (referenced by UUID)
  OrganizationUUID: string; // Parent organization
  parentCards: string[]; // Array of CardUUIDs
  childCards: string[]; // Array of CardUUIDs
  
  // 🔧 System Properties
  cardSize: string; // Aspect ratio format (width:height)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Migration Strategy for Card
```typescript
// BEFORE (current state)
{
  uuid: "d52f3507-5651-4b77-bc1b-3cff9e04b408", // ✅ Already UUID-based
  name: "#numbers",
  hashtags: ["#parent"] // ❌ Referenced by name/hashtag
}

// AFTER (UUID-centric)
{
  CardUUID: "d52f3507-5651-4b77-bc1b-3cff9e04b408", // ✅ Renamed for consistency
  CardName: "#numbers",
  OrganizationUUID: "550e8400-e29b-41d4-a716-446655440000", // ✅ Reference by UUID
  parentCards: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"] // ✅ Reference by CardUUID
}
```

### Play Entity
```typescript
interface IPlay {
  // 🔑 Primary Identifier (IMMUTABLE)
  PlayUUID: string; // UUID v4 format
  
  // 🔗 Entity References (by UUID)
  OrganizationUUID: string; // Parent organization
  SessionUUID: string; // Browser session for analytics
  DeckUUID: string; // Deck identifier
  
  // 📝 Editable Properties
  status: 'active' | 'idle' | 'completed' | 'expired';
  state: 'swiping' | 'voting' | 'comparing' | 'completed';
  
  // 🎮 Game Data
  deck: string[]; // Array of CardUUIDs
  deckTag: string; // Deck selection identifier
  swipes: ISwipe[];
  votes: IVote[];
  personalRanking: string[]; // Ordered array of CardUUIDs
  
  // 🔧 System Properties
  version: number; // Optimistic locking
  totalCards: number;
  createdAt: Date;
  lastActivity: Date;
  completedAt: Date | null;
  expiresAt: Date;
}
```

### User Entity (Future Implementation)
```typescript
interface IUser {
  // 🔑 Primary Identifier (IMMUTABLE)
  UserUUID: string; // UUID v4 format
  
  // 📝 Editable Properties
  UserName: string; // Display name, can include emojis
  UserEmail: string; // Email address
  UserDescription: string; // Bio/description
  
  // 🔗 Entity References
  OrganizationUUID: string; // Primary organization
  
  // 🔧 System Properties
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🛠️ API Endpoint Standards

### URL Structure
All API endpoints must use UUID parameters:
```
✅ GET /api/v1/organizations/{OrganizationUUID}
✅ GET /api/v1/cards/{CardUUID}
✅ GET /api/v1/plays/{PlayUUID}
✅ GET /api/v1/users/{UserUUID}

❌ GET /api/v1/organizations/{slug}
❌ GET /api/v1/cards/{name}
```

### Request/Response Format
```typescript
// Organization CRUD Operations
POST /api/v1/organizations
{
  "OrganizationName": "My Awesome Org 🚀",
  "OrganizationSlug": "my-awesome-org",
  "OrganizationDescription": "An amazing organization for ranking cool stuff!"
}

Response:
{
  "success": true,
  "organization": {
    "OrganizationUUID": "550e8400-e29b-41d4-a716-446655440000",
    "OrganizationName": "My Awesome Org 🚀",
    "OrganizationSlug": "my-awesome-org",
    "OrganizationDescription": "An amazing organization for ranking cool stuff!",
    "isActive": true,
    "createdAt": "2025-08-04T15:26:36.789Z"
  }
}

// Card CRUD Operations
POST /api/v1/cards
{
  "OrganizationUUID": "550e8400-e29b-41d4-a716-446655440000",
  "CardName": "#sports",
  "CardTitle": "Sports Categories",
  "body": {
    "textContent": "All sports-related content",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "textColor": "#ffffff"
    }
  }
}

Response:
{
  "success": true,
  "card": {
    "CardUUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "OrganizationUUID": "550e8400-e29b-41d4-a716-446655440000",
    "CardName": "#sports",
    "CardTitle": "Sports Categories",
    "isActive": true,
    "createdAt": "2025-08-04T15:26:36.789Z"
  }
}
```

### Header Requirements
All API requests must include organization context via UUID:
```
X-Organization-UUID: 550e8400-e29b-41d4-a716-446655440000
```

---

## 🗄️ Database Schema Changes

### MongoDB Collection Updates

#### Organizations Collection
```javascript
// NEW SCHEMA (UUID-centric)
const OrganizationSchema = new mongoose.Schema({
  OrganizationUUID: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'OrganizationUUID must be a valid UUID v4 format'
    }
  },
  OrganizationName: { 
    type: String, 
    required: true, 
    maxlength: 255,
    trim: true
  },
  OrganizationSlug: { 
    type: String, 
    required: true, 
    unique: true,
    maxlength: 255,
    lowercase: true,
    validate: {
      validator: (slug) => /^[a-z0-9-]+$/.test(slug),
      message: 'OrganizationSlug must contain only lowercase letters, numbers, and hyphens'
    }
  },
  OrganizationDescription: { 
    type: String, 
    maxlength: 1000,
    trim: true,
    default: ''
  },
  
  // Legacy fields (maintain for backward compatibility during migration)
  name: { type: String }, // Will be deprecated
  slug: { type: String }, // Will be deprecated
  
  // System fields
  databaseName: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient organization lookups
OrganizationSchema.index({ OrganizationUUID: 1, isActive: 1 });
OrganizationSchema.index({ OrganizationSlug: 1, isActive: 1 }); // For URL routing
```

#### Cards Collection
```javascript
// UPDATED SCHEMA (UUID-centric)
const CardSchema = new mongoose.Schema({
  CardUUID: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'CardUUID must be a valid UUID v4 format'
    }
  },
  OrganizationUUID: { 
    type: String, 
    required: true, 
    index: true,
    ref: 'Organization'
  },
  CardName: { 
    type: String, 
    required: true, 
    unique: true,
    index: true,
    validate: {
      validator: (name) => name.startsWith('#') && /^#[A-Z0-9_\-\s.]+$/i.test(name),
      message: 'CardName must be a valid hashtag format'
    }
  },
  CardTitle: { type: String, maxlength: 255 },
  CardDescription: { type: String, maxlength: 1000 },
  
  // Content structure
  body: {
    imageUrl: { type: String },
    textContent: { type: String },
    background: BackgroundStyleSchema
  },
  
  // Relationships (by UUID)
  parentCards: [{ 
    type: String,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'Parent card reference must be a valid CardUUID'
    }
  }],
  childCards: [{ 
    type: String,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'Child card reference must be a valid CardUUID'
    }
  }],
  
  // Legacy fields (maintain during migration)
  uuid: { type: String }, // Will be deprecated in favor of CardUUID
  name: { type: String }, // Will be deprecated in favor of CardName
  hashtags: [{ type: String }], // Will be deprecated in favor of parentCards
  
  // System fields
  cardSize: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes
CardSchema.index({ OrganizationUUID: 1, isActive: 1 });
CardSchema.index({ CardUUID: 1, OrganizationUUID: 1 });
```

#### Plays Collection
```javascript
// UPDATED SCHEMA (UUID-centric)
const PlaySchema = new mongoose.Schema({
  PlayUUID: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    validate: {
      validator: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
      message: 'PlayUUID must be a valid UUID v4 format'
    }
  },
  OrganizationUUID: { 
    type: String, 
    required: true, 
    index: true,
    ref: 'Organization'
  },
  SessionUUID: { 
    type: String, 
    required: true, 
    index: true
  },
  DeckUUID: { 
    type: String, 
    required: true, 
    index: true
  },
  
  // Game state
  status: { 
    type: String, 
    enum: ['active', 'idle', 'completed', 'expired'], 
    default: 'active',
    index: true 
  },
  state: {
    type: String,
    enum: ['swiping', 'voting', 'comparing', 'completed'],
    default: 'swiping',
    index: true
  },
  
  // Game data (all references by UUID)
  deck: [{ type: String }], // Array of CardUUIDs
  personalRanking: [{ type: String }], // Ordered array of CardUUIDs
  swipes: [{
    CardUUID: { type: String, required: true },
    direction: { type: String, enum: ['left', 'right'], required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  votes: [{
    CardA_UUID: { type: String, required: true },
    CardB_UUID: { type: String, required: true },
    Winner_UUID: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Legacy fields (maintain during migration)
  playUuid: { type: String }, // Will be deprecated
  sessionId: { type: String }, // Will be deprecated
  deckUuid: { type: String }, // Will be deprecated
  
  // System fields
  version: { type: Number, default: 0 },
  totalCards: { type: Number, default: 0 },
  deckTag: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true }
});

// Compound indexes
PlaySchema.index({ OrganizationUUID: 1, status: 1 });
PlaySchema.index({ SessionUUID: 1, status: 1 });
PlaySchema.index({ PlayUUID: 1, OrganizationUUID: 1 });
```

---

## 🚀 Migration Strategy

### Phase 1: Schema Extension (Backward Compatible)
1. **Add new UUID fields** to existing collections alongside legacy fields
2. **Populate UUID fields** for all existing records
3. **Update database indexes** to include UUID fields
4. **Verify data integrity** between old and new fields

```typescript
// Migration Script Example
async function migrateOrganizations() {
  const organizations = await Organization.find({});
  
  for (const org of organizations) {
    if (!org.OrganizationUUID) {
      org.OrganizationUUID = uuidv4();
      org.OrganizationName = org.name;
      org.OrganizationSlug = org.slug;
      org.OrganizationDescription = org.description || '';
      await org.save();
    }
  }
}
```

### Phase 2: API Refactoring
1. **Update middleware** to accept both slug and UUID (transition period)
2. **Refactor API endpoints** to return UUID-based responses
3. **Update validation schemas** to require UUID fields
4. **Maintain backward compatibility** for legacy field names

### Phase 3: Frontend Migration
1. **Update organization provider** to use OrganizationUUID
2. **Refactor all API calls** to send/receive UUID-based data
3. **Update state management** to use UUID as keys
4. **Update routing and navigation** to use UUIDs

### Phase 4: Legacy Cleanup
1. **Remove legacy field dependencies** from backend logic
2. **Deprecate old API endpoints** that use slug-based routing
3. **Clean up database schemas** by removing legacy fields
4. **Update documentation** to reflect UUID-only architecture

---

## ✅ Validation and Testing Strategy

### Database Integrity Checks
```typescript
// Ensure all entities have valid UUIDs
const validateUUIDs = async () => {
  const organizations = await Organization.find({ OrganizationUUID: { $exists: false } });
  const cards = await Card.find({ CardUUID: { $exists: false } });
  const plays = await Play.find({ PlayUUID: { $exists: false } });
  
  if (organizations.length > 0 || cards.length > 0 || plays.length > 0) {
    throw new Error('Migration incomplete: Some entities missing UUID fields');
  }
};
```

### API Endpoint Testing
```typescript
// Test UUID-based operations
describe('UUID-Centric API Operations', () => {
  test('Organization CRUD via UUID', async () => {
    const org = await createOrganization({
      OrganizationName: 'Test Org 🧪',
      OrganizationSlug: 'test-org'
    });
    
    expect(org.OrganizationUUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    
    const retrieved = await getOrganization(org.OrganizationUUID);
    expect(retrieved.OrganizationUUID).toBe(org.OrganizationUUID);
  });
});
```

### Frontend Integration Testing
```typescript
// Test UUID-based frontend operations
describe('Frontend UUID Integration', () => {
  test('Organization context uses UUID', () => {
    const { currentOrganization } = useOrganization();
    expect(currentOrganization?.OrganizationUUID).toBeDefined();
    expect(typeof currentOrganization?.OrganizationUUID).toBe('string');
  });
});
```

---

## 📋 Implementation Checklist

### Backend Tasks
- [ ] Add UUID fields to all entity schemas
- [ ] Create data migration scripts for existing records
- [ ] Update middleware to use UUID-based organization resolution
- [ ] Refactor all API endpoints to accept UUID parameters
- [ ] Update validation schemas to require UUID fields
- [ ] Implement UUID-based database queries
- [ ] Add comprehensive UUID validation

### Frontend Tasks
- [ ] Update OrganizationProvider to use OrganizationUUID
- [ ] Refactor all API service calls to use UUID-based endpoints
- [ ] Update state management to use UUIDs as keys
- [ ] Modify routing to use UUID parameters
- [ ] Update component props to expect UUID fields
- [ ] Implement UUID-based error handling

### Infrastructure Tasks
- [ ] Update database indexes for UUID fields
- [ ] Configure MongoDB constraints for UUID uniqueness
- [ ] Update backup/restore procedures for new schema
- [ ] Monitor performance impact of UUID-based queries
- [ ] Update deployment scripts for schema migration

### Documentation Tasks
- [ ] Update API documentation with UUID examples
- [ ] Create migration guide for developers
- [ ] Update architecture diagrams
- [ ] Document UUID validation patterns
- [ ] Create troubleshooting guide for UUID issues

---

## 🎯 Success Criteria

### Data Integrity
- ✅ 100% of entities have valid, unique UUIDs
- ✅ All entity references use UUIDs consistently
- ✅ No orphaned records or broken relationships
- ✅ Database constraints enforce UUID format and uniqueness

### API Consistency
- ✅ All CRUD operations use UUID parameters
- ✅ All responses include UUID fields
- ✅ Error messages reference entities by UUID
- ✅ Headers use UUID-based organization context

### Frontend Reliability
- ✅ All components use UUID-based props
- ✅ State management keys use UUIDs
- ✅ Navigation and routing use UUID parameters
- ✅ Error handling displays UUID-based information

### Performance Metrics
- ✅ Database query performance maintained or improved
- ✅ API response times within acceptable limits
- ✅ Frontend rendering performance unaffected
- ✅ Memory usage within normal parameters

---

## 🚨 Risk Mitigation

### Data Loss Prevention
- **Full database backups** before migration
- **Incremental migration** with rollback capabilities
- **Data validation** at each migration step
- **Parallel running** of old and new systems during transition

### Performance Monitoring
- **Query performance benchmarks** before and after migration
- **Index optimization** for UUID-based queries
- **Memory usage monitoring** for UUID storage overhead
- **API response time tracking** throughout migration

### Rollback Strategy
- **Maintain legacy fields** during transition period
- **Feature flags** for UUID vs legacy behavior
- **Automated rollback scripts** for critical failures
- **Emergency procedures** for production issues

---

## 📈 Future Enhancements

### UUID Extensions
- **Timestamped UUIDs** for chronological ordering
- **Organization-scoped UUIDs** for data partitioning
- **UUID metadata** for enhanced debugging
- **UUID analytics** for usage tracking

### Performance Optimizations
- **UUID indexing strategies** for large datasets
- **Caching layers** for UUID-based lookups
- **Query optimization** for UUID joins
- **Memory optimization** for UUID storage

### Developer Experience
- **UUID generation utilities** for testing
- **Debug tools** for UUID tracing
- **IDE plugins** for UUID validation
- **Development guidelines** for UUID best practices

---

*This document serves as the definitive guide for UUID-centric architecture implementation in the Narimato application. All development work must adhere to these standards to ensure system consistency and reliability.*
