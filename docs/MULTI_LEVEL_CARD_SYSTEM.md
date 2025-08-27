# Multi-Level Card System Documentation

## Overview

The Narimato application now uses a revolutionary **multi-level card system** that eliminates the need for separate Deck entities. Instead, cards form natural hierarchies through hashtag relationships, creating a self-organizing taxonomy where any card can be both a parent and a child simultaneously.

## Core Concept

### Single Entity Architecture
- **One Entity**: Only `Card` entities exist
- **Self-Organizing**: Hierarchy emerges from hashtag relationships
- **Infinite Depth**: Support for unlimited hierarchy levels
- **Dynamic**: Relationships change as cards are created/modified

### Card Types by Relationship

1. **ROOT DECK**: Cards with no hashtags (top-level categories)
2. **PLAYABLE DECK**: Cards that have both parents (hashtags) and children
3. **LEAF CARD**: Cards that have parents but no children

## Card Schema

```typescript
interface ICard {
  uuid: string;                    // Auto-generated unique identifier
  name: string;                    // #HASHTAG (required, unique)
  body: {
    imageUrl?: string;             // Optional image URL
    textContent?: string;          // Optional text content
    background?: BackgroundStyle;  // Optional background styling
  };
  hashtags: string[];              // Array of parent hashtag references
  isActive: boolean;               // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}

interface BackgroundStyle {
  type: 'color' | 'gradient' | 'pattern';
  value: string;                   // Color hex, gradient CSS, or pattern name
  textColor?: string;              // Text color for readability
}
```

## Hierarchy Examples

### Simple 2-Level Hierarchy
```
#SPORT (no hashtags) → ROOT DECK
├── #SOCCER (hashtags: [#SPORT]) → LEAF CARD
├── #BASKETBALL (hashtags: [#SPORT]) → LEAF CARD
└── #TENNIS (hashtags: [#SPORT]) → LEAF CARD
```

### Complex Multi-Level Hierarchy
```
#SPORT (no hashtags) → ROOT DECK
├── #SOCCER (hashtags: [#SPORT, #EUROPE]) → PLAYABLE DECK
│   ├── #LIONEL-MESSI (hashtags: [#SOCCER]) → LEAF CARD
│   ├── #CRISTIANO-RONALDO (hashtags: [#SOCCER]) → LEAF CARD
│   └── #PELE (hashtags: [#SOCCER, #BRAZIL]) → LEAF CARD
├── #BASKETBALL (hashtags: [#SPORT, #USA]) → PLAYABLE DECK
│   ├── #MICHAEL-JORDAN (hashtags: [#BASKETBALL]) → LEAF CARD
│   └── #LEBRON-JAMES (hashtags: [#BASKETBALL]) → LEAF CARD
└── #TENNIS (hashtags: [#SPORT, #INDIVIDUAL]) → PLAYABLE DECK
    ├── #SERENA-WILLIAMS (hashtags: [#TENNIS]) → LEAF CARD
    └── #ROGER-FEDERER (hashtags: [#TENNIS]) → LEAF CARD
```

## API Endpoints

### Cards API (`/api/v1/cards`)

#### GET - Retrieve Cards
```bash
GET /api/v1/cards?type=root&page=1&limit=20&search=sport
```

**Query Parameters:**
- `type`: `'root'` | `'playable'` | `'all'`
- `parent`: Get children of specific parent (e.g., `#SPORT`)
- `page`: Page number for pagination
- `limit`: Items per page
- `search`: Search in name, text content, or hashtags

**Response:**
```json
{
  "success": true,
  "cards": [
    {
      "uuid": "123e4567-e89b-12d3-a456-426614174000",
      "name": "#SPORT",
      "body": {
        "textContent": "Sports category",
        "background": {
          "type": "color",
          "value": "#667eea",
          "textColor": "#ffffff"
        }
      },
      "hashtags": [],
      "childCount": 3,
      "isPlayable": true,
      "isRoot": true,
      "isActive": true,
      "createdAt": "2025-08-02T20:00:00.000Z",
      "updatedAt": "2025-08-02T20:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### POST - Create/Update Card
```bash
POST /api/v1/cards
```

**Request Body:**
```json
{
  "uuid": "optional-for-update",
  "name": "#SOCCER",
  "body": {
    "textContent": "Soccer/Football sport",
    "imageUrl": "https://example.com/soccer.jpg",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(45deg, #667eea, #764ba2)",
      "textColor": "#ffffff"
    }
  },
  "hashtags": ["#SPORT", "#EUROPE"],
  "operation": "SAVE"
}
```

**Operations:**
- `SAVE`: Update card data only
- `GENERATE`: Create preview and upload to ImgBB
- `IMGONLY`: Use external image URL

**Response:**
```json
{
  "success": true,
  "message": "Card created successfully",
  "card": {
    "uuid": "123e4567-e89b-12d3-a456-426614174001",
    "name": "#SOCCER",
    "body": { /* ... */ },
    "hashtags": ["#SPORT", "#EUROPE"],
    "childCount": 0,
    "isPlayable": false,
    "isRoot": false
  },
  "operation": "SAVE"
}
```

### Play API (`/api/v1/play/start`)

#### POST - Start Play Session
```bash
POST /api/v1/play/start
```

**Request Body:**
```json
{
  "cardName": "#SPORT",
  "sessionId": "browser-session-uuid"
}
```

**Response:**
```json
{
  "playUuid": "play-session-uuid",
  "browserSessionId": "browser-session-uuid",
  "deckUuid": "deck-uuid",
  "cardName": "#SPORT",
  "expiresAt": "2025-08-03T20:00:00.000Z",
  "deck": [
    {
      "uuid": "card-uuid-1",
      "name": "#SOCCER",
      "body": { /* ... */ },
      "hashtags": ["#SPORT"]
    }
  ]
}
```

## Utility Functions

### Card Hierarchy Utils (`/app/lib/utils/cardHierarchy.ts`)

```typescript
// Get all children of a card
const children = await getChildren('#SPORT');

// Get all parents of a card
const parents = await getParents(soccerCard);

// Check if card is playable (has children)
const canPlay = await isPlayable('#SPORT');

// Get all root decks
const rootDecks = await getRootDecks();

// Get all playable cards with child counts
const playableCards = await getPlayableCards();

// Get complete hierarchy tree
const tree = await getHierarchyTree();

// Validate hashtag format
const isValid = isValidHashtag('#SPORT');

// Get available hashtags for selection
const hashtags = await getAvailableHashtags();

// Check if hashtag name is taken
const taken = await isHashtagTaken('#SPORT');

// Rename hashtag and update all references
const updatedCount = await renameHashtag('#SPORT', '#SPORTS');
```

## Validation Rules

### Hashtag Format
- Must start with `#`
- Can contain letters, numbers, hyphens, and underscores
- Case-insensitive but stored as uppercase
- Examples: `#SPORT`, `#LIONEL-MESSI`, `#GOAT_2024`

### Card Name
- Must be unique across all cards
- Must follow hashtag format rules
- Cannot be empty or just `#`

### Hashtag References
- All hashtags in `hashtags` array must reference existing cards
- Cannot reference self (circular reference prevention)
- Must follow hashtag format rules

## Database Operations

### Indexes
```javascript
// Performance indexes
{ name: 1 }              // Unique index on card names
{ uuid: 1 }              // Unique index on UUIDs
{ isActive: 1, createdAt: -1 }  // Compound index for active cards
{ hashtags: 1 }          // Array index for hashtag lookups
```

### Aggregation Queries

#### Find Playable Cards
```javascript
[
  { $match: { isActive: true } },
  {
    $lookup: {
      from: 'cards',
      let: { cardName: '$name' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $in: ['$$cardName', '$hashtags'] },
                { $eq: ['$isActive', true] }
              ]
            }
          }
        }
      ],
      as: 'children'
    }
  },
  {
    $addFields: {
      childCount: { $size: '$children' }
    }
  },
  {
    $match: {
      childCount: { $gt: 0 }
    }
  }
]
```

## Migration from Old System

### Data Migration Steps
1. **Backup existing data**
2. **Clean database** (remove old decks and cards)
3. **Create cards with new schema**
4. **Establish hashtag relationships**
5. **Verify hierarchy integrity**

### Breaking Changes
- Deck model removed entirely
- Card schema completely changed
- API endpoints restructured
- Play logic updated to use card names instead of deck tags

## Usage Examples

### Creating a Hierarchy

1. **Create Root Deck:**
```javascript
POST /api/v1/cards
{
  "name": "#SPORT",
  "body": { "textContent": "Sports category" },
  "hashtags": [],
  "operation": "SAVE"
}
```

2. **Create Child Cards:**
```javascript
POST /api/v1/cards
{
  "name": "#SOCCER",
  "body": { "textContent": "Soccer/Football" },
  "hashtags": ["#SPORT"],
  "operation": "SAVE"
}
```

3. **Create Grandchild Cards:**
```javascript
POST /api/v1/cards
{
  "name": "#LIONEL-MESSI",
  "body": { 
    "textContent": "Lionel Messi - Soccer Legend",
    "imageUrl": "https://example.com/messi.jpg"
  },
  "hashtags": ["#SOCCER"],
  "operation": "IMGONLY"
}
```

### Playing a Deck

```javascript
POST /api/v1/play/start
{
  "cardName": "#SPORT",
  "sessionId": "user-session-id"
}
// Returns all children of #SPORT for playing
```

## Benefits

1. **Simplified Architecture**: Single entity instead of Card + Deck
2. **Infinite Flexibility**: Any card can become a deck if referenced
3. **Self-Organizing**: Hierarchy emerges naturally from relationships
4. **Dynamic Structure**: Relationships can change without breaking the system
5. **Intuitive Logic**: Parent-child relationships through hashtag references
6. **Scalable**: Supports unlimited hierarchy depth and complexity

## Best Practices

1. **Naming Convention**: Use descriptive, uppercase hashtag names
2. **Hierarchy Design**: Start with broad categories, narrow down
3. **Relationship Validation**: Always verify parent cards exist before referencing
4. **Performance**: Use appropriate indexes for your query patterns
5. **Data Integrity**: Implement proper validation and error handling

## Troubleshooting

### Common Issues

1. **Hashtag Not Found**: Verify parent card exists before adding to hashtags array
2. **Circular References**: Prevent cards from referencing themselves
3. **Invalid Format**: Ensure hashtags follow #[A-Z0-9_-]+ pattern
4. **Performance**: Use indexes and limit hierarchy depth queries

### Debug Queries
```javascript
// Find orphaned cards (hashtags reference non-existent cards)
const orphaned = await Card.find({
  hashtags: { $not: { $in: await Card.distinct('name') } }
});

// Find circular references
const checkCircular = async (cardName, visited = new Set()) => {
  if (visited.has(cardName)) return true;
  visited.add(cardName);
  const card = await Card.findOne({ name: cardName });
  return card?.hashtags.some(tag => checkCircular(tag, visited));
};
```

## Future Enhancements

1. **Visual Hierarchy Browser**: Tree view of card relationships
2. **Bulk Operations**: Mass update hashtag references
3. **Import/Export**: Hierarchy backup and restore
4. **Analytics**: Hierarchy usage statistics
5. **Auto-Suggestions**: Smart hashtag recommendations
6. **Validation Dashboard**: Integrity checking tools
