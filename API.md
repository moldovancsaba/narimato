# API Documentation

## Base URL
```
/api
```

## Endpoints

### Cards API

#### GET `/api/cards`
Retrieves a list of all active cards.

**Response**
- `200 OK`: Returns an array of card objects
- `500 Internal Server Error`: If there's a server error

#### POST `/api/cards`
Creates a new card.

**Request Body**
```typescript
{
  title: string;           // Required
  description?: string;    // Optional
  content: string;        // Required
  type: 'text' | 'image'; // Required
  hashtags: string[];     // Required
  imageAlt?: string;      // Optional, for image cards
}
```

**Response**
- `201 Created`: Returns the created card object
- `400 Bad Request`: If validation fails
- `409 Conflict`: If a card with the same title exists
- `500 Internal Server Error`: If there's a server error

#### GET `/api/cards/[slug]`
Retrieves a specific card by its slug.

**Parameters**
- `slug`: URL-friendly identifier for the card

**Response**
- `200 OK`: Returns the card object
- `404 Not Found`: If the card doesn't exist
- `500 Internal Server Error`: If there's a server error

#### GET `/api/cards/random`
Retrieves a random card.

**Response**
- `200 OK`: Returns a random card object
- `404 Not Found`: If no cards are available
- `500 Internal Server Error`: If there's a server error

### Leaderboard API

#### GET `/api/leaderboard`
Retrieves leaderboard data.

**Query Parameters**
- `type`: 'global' | 'project' | 'personal' (default: 'global')
- `projectId`: string (required for project type)
- `page`: number (default: 1)
- `limit`: number (default: 10, max: 50)
- `includeTrending`: boolean (optional, default: false) - Include trending cards based on recent votes

**Headers**
- `session-id`: Required for personal leaderboard

**Response**
- `200 OK`: Returns leaderboard data with the following structure:
  ```typescript
  {
    items: Array<{
      id: string;
      title: string;
      rank: number;
      score: number;
      votes: number;
      trend?: 'up' | 'down' | 'stable';
      lastVotedAt?: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }
  ```
- `400 Bad Request`: If parameters are invalid
- `500 Internal Server Error`: If there's a server error

### Swipe API

#### POST `/api/swipe`
Records a swipe action on a card.

**Request Body**
```typescript
{
  cardId: string;
  direction: 'left' | 'right';
}
```

**Headers**
- `session-id`: Optional, used to track user preferences

**Response**
- `200 OK`: Returns success status
- `400 Bad Request`: If request data is invalid
- `404 Not Found`: If the card doesn't exist
- `500 Internal Server Error`: If there's a server error

### Vote API

#### POST `/api/vote`
Records a vote between two cards and updates their ELO ratings.

**Request Body**
```typescript
{
  winnerId: string;   // Required
  loserId: string;    // Required
  projectId?: string; // Optional, for project-specific rankings
}
```

**Response**
- `200 OK`: Returns success message and new ratings
- `400 Bad Request`: If required IDs are missing
- `404 Not Found`: If one or both cards don't exist
- `500 Internal Server Error`: If there's a server error

## Error Responses

All API endpoints follow a consistent error response format:

```typescript
{
  message: string;
  errors?: Array<{
    code: string;
    message: string;
    path?: string[];
  }>;
}
```

## Authentication

The API currently employs a session-based system with the following headers:
- `session-id`: Utilized for user identification and preference tracking.
- `Authorization`: Reserved for the integration of a future token-based authentication system.

This setup allows for secured API interactions, aligning with future-proofing strategies.

## Rate Limiting

API endpoints are protected by rate limiting with the following defaults:
- 100 requests per minute per IP address
- 1000 requests per hour per session
