# Hashtag Hierarchy System Documentation

## Overview

The Hashtag Hierarchy System in NARIMATO provides a flexible, multi-level organization of cards based on a hashtag-based hierarchy. This new approach eliminates the need for fixed deck structures, allowing for dynamic and adaptable card management.

## Hierarchy Structure

- **Parent-Child Relationships**: Hashtags can define parent-child relationships, enabling tiered categorization of cards.
- **Dynamic Tagging**: Cards are tagged with hashtags that indicate their category and level in the hierarchy.
- **Circular Dependency Prevention**: The system automatically checks for and prevents circular dependencies between tags.

## Card Selection

- **Dynamic Card Fetching**: Cards are fetched dynamically based on user-selected deck tags at the start of a play session.
- **Tag-Based Playability**: Only cards meeting specific tag-based criteria are included in a session.
- **Automatic Hierarchy Updates**: Changes in hashtag relationships are reflected in real-time across the application.

## Playability Rules

- **Minimum Card Threshold**: A minimum of 2 cards is required for a category to be considered playable, ensuring meaningful ranking experiences (DECK_RULES.MIN_CARDS_FOR_PLAYABLE = 2).
- **Filtering Logic**: The system employs real-time filtering based on playability rules, ensuring smooth and relevant game sessions.

## System Integration

- **API Endpoints**: Integrated seamlessly with `/api/v1/play/start` and `/api/v1/play/results` for starting and completing sessions.
- **UI Enhancements**: User interfaces dynamically reflect hashtag relationships, providing clear pathways for selection and filtering.
- **Backend Support**: Robust backend logic supports real-time updates and dynamic data flows.

## Benefits over Deck-Based Model

- **Flexibility**: Greater flexibility in organizing cards without rigid deck structures.
- **Scalability**: Supports larger and more complex card arrangements without increasing overhead.
- **User Experience**: Enhanced experience through adaptive, real-time card selection and hierarchy management.

## Technical Implementation

- **Hierarchical Validation**: System performs validation checks to maintain hierarchy integrity and prevent misconfigurations.
- **Efficient Querying**: Optimized queries support rapid updates and card selections using MongoDB `$or` operators for parent-child relationships.
- **Global Rankings Integration**: Rankings API properly filters cards using both direct name matches and hashtag array references.
- **Data Model Alignment**: Card filtering logic correctly uses `hashtags` array field instead of deprecated `tags` field.
- **Seamless Transition**: Smooth transition from deck-based systems to hashtag hierarchies, maintaining consistency in play sessions.

### API Implementation Details

```javascript
// Proper hashtag filtering for global rankings
cardFilter = { 
  isActive: true,
  $or: [
    { name: deckTag }, // Parent card matches directly
    { hashtags: deckTag } // Child card contains hashtag reference
  ]
};

// Correct card data mapping
{
  type: card.body?.imageUrl ? 'media' : 'text',
  content: {
    text: card.body?.textContent,
    mediaUrl: card.body?.imageUrl
  }
}
```

## Conclusion

The Hashtag Hierarchy System represents a significant advancement in NARIMATO's card management architecture, leveraging dynamic relationships and real-time adaptability to enhance both user experience and system performance.
