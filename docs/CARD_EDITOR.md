# Card Editor Documentation

**Version:** 3.6.1  
**Last Updated:** 2025-08-02

## Overview

The NARIMATO Card Editor is a comprehensive content management system for creating and editing cards within the application. It features advanced functionality including smart hashtag management, URL-friendly slugs, dual card types, and real-time live preview.

## Features

### 🎯 Dual Mode Operation
- **Create Mode**: Build new cards from scratch with full customization
- **Edit Mode**: Modify existing cards with data pre-loaded and UUID display

### 🏷️ Smart Hashtag Management
- **Predictive Suggestions**: Common hashtags suggested as you type
- **Keyboard Navigation**: Arrow keys to navigate suggestions, Enter to add
- **Visual Management**: Modern pill-style display with click-to-remove functionality
- **Duplicate Prevention**: Intelligent prevention of duplicate hashtags
- **Common Database**: Pre-loaded with popular hashtags (funny, educational, technology, etc.)

### 🔗 URL-Friendly Slugs
- **SEO Optimization**: Automatic conversion to URL-friendly format
- **Real-time Formatting**: Live formatting as you type
- **Character Validation**: Only letters, numbers, and hyphens allowed
- **Preview Integration**: Slug changes reflected in live preview

### 📋 Card Types
- **Text Cards**: Rich text content with styling options
- **Media Cards**: Image-based cards with URL input and validation
- **Type Switching**: Easy switching between types with proper state management

## User Interface

### Navigation Access
- **From Cards List**: Click "Edit" on any card in `/cards` to open the editor
- **Direct URL**: Access via `/card-editor` for new card creation
- **Edit URL**: `/card-editor?uuid={card-uuid}` for existing card editing

### Interface Sections

#### 1. Card Information
- Card type selector (Text/Media)
- Title input field
- URL-friendly slug editor
- Smart hashtag editor

#### 2. Content Section
- **Text Cards**: Rich textarea for text content
- **Media Cards**: Image URL input with validation
- Dynamic content based on selected card type

#### 3. Styling Options
- Background presets and custom gradients
- Font family selection with Google Fonts support
- Text color, size, and alignment controls
- Card dimensions and padding adjustments

#### 4. Live Preview
- Real-time preview of all changes
- PNG generation with proper font loading
- Image preview for media cards
- Responsive preview container

#### 5. Actions Panel
- Image upload to ImgBB (for media cards)
- Save/Update card functionality
- Download PNG preview
- Form validation with error handling

## API Integration

### Endpoints Used
- `GET /api/v1/cards/[uuid]` - Fetch existing card data
- `POST /api/v1/cards/add` - Create new card
- `PATCH /api/v1/cards/[uuid]` - Update existing card
- `POST /api/v1/upload/imgbb` - Upload images to ImgBB

### Data Flow
1. **Load**: Fetch card data if editing existing card
2. **Edit**: Real-time state management with live preview
3. **Validate**: Client-side and server-side validation
4. **Save**: Atomic updates with error handling
5. **Feedback**: Success/error messages with appropriate actions

## Technical Implementation

### Component Architecture
```
CardEditorPage (Suspense Wrapper)
├── CardEditorContent (Main Component)
│   ├── Card Information Section
│   │   ├── Type Selector
│   │   ├── Title Input
│   │   ├── Slug Editor
│   │   └── HashtagEditor Component
│   ├── Content Section (Dynamic)
│   ├── Styling Options
│   ├── Live Preview
│   └── Actions Panel
└── Loading Fallback
```

### Key Components

#### HashtagEditor
```typescript
interface HashtagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}
```

**Features:**
- Predictive text input with suggestion dropdown
- Keyboard navigation (Arrow keys, Enter, Escape)
- Visual tag management with remove buttons
- Duplicate prevention and validation

#### State Management
```typescript
// Card-specific state
const [cardData, setCardData] = useState<Card | null>(null);
const [cardSlug, setCardSlug] = useState('');
const [cardTitle, setCardTitle] = useState('');
const [cardTags, setCardTags] = useState<string[]>([]);
const [cardType, setCardType] = useState<'text' | 'media'>('media');

// Live preview state
const [config, setConfig] = useState<SVGCardConfig>({...});
const [pngDataUrl, setPngDataUrl] = useState<string>('');
```

### Validation Rules

#### Text Cards
- Text content is required
- Title is optional
- Hashtags are optional but recommended
- Slug must be URL-friendly

#### Media Cards
- Image URL is required (either uploaded or provided)
- URL validation for proper format
- Title is optional
- Hashtags are optional but recommended
- Slug must be URL-friendly

#### Slug Validation
- Only letters, numbers, and hyphens allowed
- Automatic conversion to lowercase
- Real-time formatting and validation
- Uniqueness validation (server-side)

## User Experience

### Workflow for New Cards
1. Navigate to `/card-editor`
2. Select card type (Text/Media)
3. Enter title and content
4. Add relevant hashtags using smart editor
5. Set URL-friendly slug
6. Customize styling in live preview
7. Save card with validation feedback

### Workflow for Editing Cards
1. Navigate to `/cards` and click "Edit" on desired card
2. Card editor loads with existing data pre-filled
3. UUID displayed prominently for identification
4. Modify any fields with real-time preview
5. Save changes with validation
6. Return to cards list or continue editing

### Error Handling
- **Validation Errors**: Real-time feedback with specific error messages
- **Network Errors**: Retry mechanisms with user feedback
- **State Errors**: Automatic recovery with local state backup
- **Upload Errors**: Clear error messages with retry options

## Accessibility

### Keyboard Navigation
- Full keyboard navigation support
- Tab order follows logical flow
- Arrow key navigation in hashtag suggestions
- Enter/Escape keys for hashtag management

### Screen Reader Support
- Proper ARIA labels for form elements
- Status announcements for actions
- Descriptive text for interactive elements
- Error message associations

### Visual Accessibility
- High contrast mode support
- Responsive design for all screen sizes
- Clear visual hierarchy and spacing
- Consistent color scheme with theming

## Performance Considerations

### Optimization Strategies
- **Suspense Boundaries**: Proper loading states for async operations
- **Debounced Inputs**: Reduced API calls during typing
- **Memoized Components**: Optimized re-rendering with React.memo
- **Image Optimization**: Efficient image handling and preview generation

### Bundle Size
- **Component Splitting**: HashtagEditor as separate component
- **Lazy Loading**: Dynamic imports where appropriate
- **Tree Shaking**: Unused code elimination
- **Font Loading**: Optimized Google Fonts integration

## Future Enhancements

### Planned Features
- **Bulk Operations**: Multiple card editing and management
- **Template System**: Pre-designed card templates
- **Advanced Validation**: Real-time collaboration features
- **Export Options**: Multiple export formats beyond PNG
- **Card Analytics**: Usage statistics and performance metrics

### Technical Improvements
- **Real-time Collaboration**: Multiple users editing simultaneously
- **Version History**: Track and revert changes
- **Advanced Preview**: 3D preview and animation effects
- **AI Integration**: Smart content suggestions and optimization

## Troubleshooting

### Common Issues

#### Card Not Loading
- Check UUID parameter in URL
- Verify card exists in database
- Check network connectivity
- Clear browser cache if necessary

#### Hashtag Suggestions Not Working
- Verify JavaScript is enabled
- Check for console errors
- Try refreshing the page
- Clear browser storage

#### Preview Not Updating
- Check image URL validity
- Verify font loading
- Clear browser cache
- Check console for errors

#### Save Failures
- Verify all required fields are filled
- Check network connectivity
- Validate image URLs
- Check server logs for detailed errors

### Support
For technical issues or feature requests, refer to the main project documentation or create an issue in the project repository.
