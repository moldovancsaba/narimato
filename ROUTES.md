# Route Structure

## Public Routes
- `/cards/[slug]`: Public card view
- `/projects/[slug]`: Public project view
- `/users/[slug]`: Public user profile

## Management Routes
- `/manage/cards/[slug]`: Card management
- `/manage/projects/[slug]`: Project management
- `/manage/users/[slug]`: User management

## API Routes
### Public
- `/api/cards/[slug]`: Public card operations
- `/api/projects/[slug]`: Public project operations
- `/api/users/[slug]`: Public user operations

### Management
- `/api/manage/cards/[slug]`: Card management operations
- `/api/manage/projects/[slug]`: Project management operations
- `/api/manage/users/[slug]`: User management operations

## Notes
- All routes use `[slug]` for consistency
- Management routes use `/manage` prefix
- We resolve the slug type (name vs hash) in the route handler
- For management routes, the slug must be a valid MD5 hash
- For public routes, the slug must be a valid URL-friendly string

## Cards

- View: `/cards/[slug]`
- Edit: `/manage/cards/[md5]`
- Create: `/cards/create`

API:
- `/api/view/cards/[slug]` - Get by slug (for display)
- `/api/manage/cards/[slug]` - Get/update by ID
- `/api/cards` - List/create

## Projects

- View: `/projects/[slug]`
- Edit: `/manage/projects/[md5]`
- Create: `/projects/create`

API:
- `/api/view/projects/[slug]` - Get by slug (for display)
- `/api/manage/projects/[slug]` - Get/update by ID
- `/api/projects` - List/create

This structure:
1. Uses appropriate parameter names ([slug] for public routes, [md5] for management)
2. Separates public/management concerns clearly
3. Uses a consistent pattern across cards and projects
4. Maintains proper lookup (MD5 vs slug) in the appropriate API layer
