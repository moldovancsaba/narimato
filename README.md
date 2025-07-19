![Version](https://img.shields.io/badge/version-7.3.0-blue.svg)

NARIMATO is a real-time, card-based web application built with Next.js, MongoDB Atlas, and Vercel. It enables dynamic image/text-based card management with features like user voting, ranking, and comprehensive leaderboard functionality. Built for seamless deployment on Vercel, it provides an enterprise-grade platform for HR management and frame-based content organization.

## 📑 Documentation

- [Architecture](./ARCHITECTURE.md) - System design and components
- [API Documentation](./API.md) - API endpoints and usage
- [Roadmap](./ROADMAP.md) - Development phases and milestones
- [Task List](./TASKLIST.md) - Current development progress
- [Release Notes](./RELEASE_NOTES.md) - Version history and changes

## 🔓 Public Access Documentation

NARIMATO provides public access to content with built-in rate limiting and security measures. This approach ensures open accessibility while maintaining system integrity.

### Key Features

- **Instant Access**:
  - No registration required
  - Immediate platform access
  - All content publicly viewable

- **Available Features**:
  - Browse all projects and cards
  - View project details and card content
  - Participate in card voting (rate-limited)
  - Access basic platform features

- **Security & Rate Limiting**:
  - 50 votes/hour limit
  - IP-based abuse prevention
  - Automated threat detection
  - System integrity protection

### Limitations

- No content creation capabilities
- No project management features
- Rate-limited voting system
- Read-only access

For detailed technical information and implementation details, refer to the [Architecture Documentation](./ARCHITECTURE.md).

## 🔄 Project Management Flows

### Development Workflow

1. **Task Creation f Assignment**
   - New tasks are created in TASKLIST.md
   - Each task includes: title, owner, expected delivery date
   - Tasks are prioritized and tracked in real-time
   - Tasks are assigned clear acceptance criteria
   - Dependencies are documented and tracked

2. **Development Process**
   - Clone repository and create feature branch
   - Follow coding standards and documentation rules
   - Implement features with appropriate test coverage
   - Update documentation as needed

3. **Review & Deployment**
   - Create pull request with detailed description
   - Pass automated checks (linting, type checking)
   - Get code review approval
   - Merge to appropriate branch based on environment

### Navigation System

NARIMATO implements a sophisticated navigation system that balances user experience, SEO optimization, and security:

#### 1. Public URLs (User-Facing)
```
# View card content
/cards/my-awesome-project-card

# Browse project
/projects/hr-management-2025

# View user profile
/users/john-smith
```

#### 2. Management URLs (Administrative)
```
# Card management
/cards/5d41402abc4b2a76b9719d911017c592/edit

# Project configuration
/projects/8d777f385d3dfec8815d20f7496026dc/edit

# User settings
/users/7d793037a0760186574b0282f2f435e7/settings
```

#### Navigation Configuration

1. Route Protection:
```typescript
// Protected route configuration in next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/cards/:hash/edit',
        has: [{ type: 'header', key: 'authorization', missing: true }],
        permanent: false,
        destination: '/auth/login'
      },
      // Add similar rules for other protected routes
    ]
  }
}
```

2. Access Control:
```typescript
// Access level configuration in middleware.ts
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtectedRoute = pathname.includes('/edit') || 
                          pathname.includes('/settings')
  
  if (isProtectedRoute && !isAuthenticated(req)) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  return NextResponse.next()
}
```

3. Rate Limiting:
```typescript
// Rate limit configuration
const limiter = new RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
```

### Example Usage

Here's a quick example of how to use the NARIMATO platform:

1. **Create and Manage Content**:
   - Create a new card at `/cards/create`
   - View your card at `/cards/your-card-title`
   - Edit it at `/cards/[MD5_HASH]/edit`

2. **Project Management**:
   - Create a project at `/projects/create`
   - View it at `/projects/your-project-name`
   - Manage settings at `/projects/[MD5_HASH]/edit`

3. **User Features**:
   - Access your profile at `/users/your-name`
   - Manage settings at `/users/[MD5_HASH]/settings`

These steps illustrate how users can actively participate and manage content within the NARIMATO ecosystem. For more details, check the section for each specific feature.

### Version Control Protocol

- **Patch Updates (0.0.X)**
  - Bug fixes and minor improvements
  - Documentation updates
  - No breaking changes

- **Minor Updates (0.X.0)**
  - New features with backward compatibility
  - Significant documentation updates
  - Performance improvements

- **Major Updates (X.0.0)**
  - Breaking changes
  - Architectural updates
  - Major feature additions

### Release Process

1. **Pre-Release**
   - Update version numbers
   - Complete documentation updates
   - Verify all changes in staging

2. **Deployment**
   - Merge to main branch
   - Tag release in git
   - Deploy to production

3. **Post-Release**
   - Monitor for issues
   - Update RELEASE_NOTES.md
   - Clear deployment cache if needed

## 🚀 Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   ```env
   MONGO_URI=your_mongodb_atlas_uri
   IMGBB_API_KEY=your_imgbb_api_key
   VERCEL_ENV=development
   ```
4. Run development server: `npm run dev`
5. Visit http://localhost:3000

## 🛠 Tech Stack

- **Frontend/Backend**: Next.js + React.js
- **Database**: MongoDB Atlas
- **Deployment**: Vercel
- **Image Hosting**: ImgBB API
- **Styling**: Tailwind CSS + Material-UI

## 🔐 Security

- Input validation with Zod
- Rate limiting
- Secure session management
- Protected admin endpoints

## 📱 Features

### Core Features
- Responsive, mobile-first design
- Dark mode support
- Real-time updates via Socket.io
- Global and project-based leaderboards
- Enhanced card management system:
  - Create, edit, and delete cards
  - Support for image and text cards
  - Real-time voting and ranking
  - Hashtag-based organization
  - Optional translations
- Comprehensive project management:
  - Project creation and configuration
  - Card organization within projects
  - Visibility controls
  - Real-time collaborative features

### Anonymous User Features
- Instant platform access
- Public content browsing
- Rate-limited voting system
  - 50 votes per hour
  - Anti-abuse protection
  - Activity tracking
- Session persistence (30 days)
- Privacy-focused design
- Clear upgrade pathways

### Authenticated Features
- Full platform access
- Project creation and management
- Unlimited voting capabilities
- Content creation and editing
- Customizable preferences
- Activity history

## 🌐 Deployment

Deployment is automated via Vercel with the following flow:
1. Commits to `dev` -> Development environment
2. Merges to `staging` -> Staging environment
3. Merges to `main` -> Production environment
