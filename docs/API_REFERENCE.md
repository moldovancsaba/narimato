# Multi-Level Card System API Reference

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Currently no authentication required. All endpoints are public.

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional detailed error information"
}
```

Common HTTP status codes:
- `400`: Bad Request - Invalid input data
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Duplicate resource (e.g., hashtag already exists)
- `500`: Internal Server Error

---

## Cards Endpoints

### GET /api/v1/cards
Retrieve cards with filtering, searching, and hierarchy information.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number for pagination |
| `limit` | integer | `20` | Items per page (max 100) |
| `search` | string | `""` | Search in name, text content, or hashtags |
| `type` | string | `"all"` | Filter by card type: `"root"`, `"playable"`, `"all"` |
| `parent` | string | - | Get children of specific parent (e.g., `#SPORT`) |

#### Example Requests
```bash
# Get all cards
GET /api/v1/cards

# Get root decks only
GET /api/v1/cards?type=root

# Get playable cards (cards with children)
GET /api/v1/cards?type=playable

# Get children of #SPORT
GET /api/v1/cards?parent=#SPORT

# Search for "soccer" with pagination
GET /api/v1/cards?search=soccer&page=1&limit=10
```

#### Response
```json
{
  "success": true,
  "cards": [
    {
      "uuid": "123e4567-e89b-12d3-a456-426614174000",
      "name": "#SPORT",
      "body": {
        "textContent": "Sports category",
        "imageUrl": "https://example.com/sport.jpg",
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

### POST /api/v1/cards
Create a new card or update an existing one.

#### Request Body
```json
{
  "uuid": "optional-uuid-for-update",
  "name": "#HASHTAG-NAME",
  "body": {
    "textContent": "Optional text content",
    "imageUrl": "https://example.com/image.jpg",
    "background": {
      "type": "color|gradient|pattern",
      "value": "#667eea",
      "textColor": "#ffffff"
    }
  },
  "hashtags": ["#PARENT1", "#PARENT2"],
  "operation": "SAVE|GENERATE|IMGONLY"
}
```

#### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uuid` | string | No | UUID for updates. Omit for new cards |
| `name` | string | Yes | Unique hashtag name (e.g., `#SPORT`) |
| `body.textContent` | string | No | Text content for the card |
| `body.imageUrl` | string | No | Image URL |
| `body.background` | object | No | Background styling |
| `hashtags` | array | No | Array of parent hashtag references |
| `operation` | string | No | Operation type (default: `SAVE`) |

#### Operations
- **SAVE**: Update card data only (no image generation)
- **GENERATE**: Create preview image and upload to ImgBB
- **IMGONLY**: Use external image URL without generation

#### Example Requests

**Create Root Deck:**
```json
POST /api/v1/cards
{
  "name": "#SPORT",
  "body": {
    "textContent": "Sports category",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(45deg, #667eea, #764ba2)",
      "textColor": "#ffffff"
    }
  },
  "hashtags": [],
  "operation": "SAVE"
}
```

**Create Child Card:**
```json
POST /api/v1/cards
{
  "name": "#SOCCER",
  "body": {
    "textContent": "Soccer/Football sport",
    "imageUrl": "https://example.com/soccer.jpg"
  },
  "hashtags": ["#SPORT"],
  "operation": "IMGONLY"
}
```

**Update Existing Card:**
```json
POST /api/v1/cards
{
  "uuid": "existing-card-uuid",
  "name": "#SOCCER",
  "body": {
    "textContent": "Updated soccer description"
  },
  "hashtags": ["#SPORT", "#EUROPE"],
  "operation": "SAVE"
}
```

#### Response
```json
{
  "success": true,
  "message": "Card created successfully",
  "card": {
    "uuid": "123e4567-e89b-12d3-a456-426614174001",
    "name": "#SOCCER",
    "body": {
      "textContent": "Soccer/Football sport",
      "imageUrl": "https://example.com/soccer.jpg"
    },
    "hashtags": ["#SPORT"],
    "childCount": 0,
    "isPlayable": false,
    "isRoot": false,
    "isActive": true,
    "createdAt": "2025-08-02T20:00:00.000Z",
    "updatedAt": "2025-08-02T20:00:00.000Z"
  },
  "operation": "IMGONLY"
}
```

---

## Play Endpoints

### POST /api/v1/play/start
Start a new play session with a specific card's children.

#### Request Body
```json
{
  "cardName": "#HASHTAG-NAME",
  "sessionId": "browser-session-uuid"
}
```

#### Field Descriptions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cardName` | string | Yes | Name of the card to play (must have children) |
| `sessionId` | string | No | Browser session ID for analytics |

#### Example Request
```json
POST /api/v1/play/start
{
  "cardName": "#SPORT",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Response
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
      "body": {
        "textContent": "Soccer/Football sport",
        "imageUrl": "https://example.com/soccer.jpg",
        "background": {
          "type": "color",
          "value": "#667eea",
          "textColor": "#ffffff"
        }
      },
      "hashtags": ["#SPORT"]
    },
    {
      "uuid": "card-uuid-2",
      "name": "#BASKETBALL",
      "body": {
        "textContent": "Basketball sport",
        "imageUrl": "https://example.com/basketball.jpg"
      },
      "hashtags": ["#SPORT"]
    }
  ]
}
```

#### Error Responses
```json
// Card not found
{
  "error": "Card not found"
}

// Card has no children
{
  "error": "Card has no children to play"
}

// Missing card name
{
  "error": "Card name is required"
}
```

---

## Utility Functions API

These functions are available in the codebase but not as direct HTTP endpoints. They're used internally by the API endpoints.

### getChildren(cardName: string)
Returns all child cards of the specified parent.

```typescript
const children = await getChildren('#SPORT');
// Returns: ICard[]
```

### getParents(card: ICard)
Returns all parent cards of the specified card.

```typescript
const parents = await getParents(soccerCard);
// Returns: ICard[]
```

### isPlayable(cardName: string)
Checks if a card has children and can be played.

```typescript
const canPlay = await isPlayable('#SPORT');
// Returns: boolean
```

### getRootDecks()
Returns all cards with no parents (root level cards).

```typescript
const rootDecks = await getRootDecks();
// Returns: ICard[]
```

### getPlayableCards()
Returns all cards that have children with their child counts.

```typescript
const playableCards = await getPlayableCards();
// Returns: Array<ICard & { childCount: number }>
```

### getHierarchyTree()
Returns the complete hierarchy tree structure.

```typescript
const tree = await getHierarchyTree();
// Returns: nested tree structure
```

### getAvailableHashtags()
Returns all available hashtag names for selection.

```typescript
const hashtags = await getAvailableHashtags();
// Returns: string[]
```

### isHashtagTaken(name: string)
Checks if a hashtag name is already in use.

```typescript
const taken = await isHashtagTaken('#SPORT');
// Returns: boolean
```

### renameHashtag(oldName: string, newName: string)
Renames a hashtag and updates all references.

```typescript
const updatedCount = await renameHashtag('#SPORT', '#SPORTS');
// Returns: number (count of updated cards)
```

---

## Data Models

### Card Interface
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
```

### BackgroundStyle Interface
```typescript
interface BackgroundStyle {
  type: 'color' | 'gradient' | 'pattern';
  value: string;                   // Color hex, gradient CSS, or pattern name
  textColor?: string;              // Text color for readability (default: #ffffff)
}
```

### Extended Card Response
API responses include additional computed fields:
```typescript
interface CardResponse extends ICard {
  childCount: number;              // Number of child cards
  isPlayable: boolean;            // True if card has children
  isRoot: boolean;                // True if card has no parents
}
```

---

## Examples

### Complete Workflow Example

1. **Create a sports hierarchy:**

```bash
# Create root deck
POST /api/v1/cards
{
  "name": "#SPORT",
  "body": { "textContent": "Sports category" },
  "hashtags": [],
  "operation": "SAVE"
}

# Create soccer category
POST /api/v1/cards
{
  "name": "#SOCCER",
  "body": { "textContent": "Soccer/Football" },
  "hashtags": ["#SPORT"],
  "operation": "SAVE"
}

# Create Messi card
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

2. **Browse the hierarchy:**

```bash
# Get all root decks
GET /api/v1/cards?type=root

# Get children of SPORT
GET /api/v1/cards?parent=#SPORT

# Get children of SOCCER
GET /api/v1/cards?parent=#SOCCER
```

3. **Start playing:**

```bash
# Play SPORT deck (shows SOCCER and other sports)
POST /api/v1/play/start
{
  "cardName": "#SPORT",
  "sessionId": "session-id"
}

# Play SOCCER deck (shows MESSI and other players)
POST /api/v1/play/start
{
  "cardName": "#SOCCER",
  "sessionId": "session-id"
}
```

This API design supports the complete multi-level card system with intuitive endpoints for creating, browsing, and playing with hierarchical card structures.
