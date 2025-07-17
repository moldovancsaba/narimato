![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)

NARIMATO is a real-time, card-based web application built with Next.js, MongoDB Atlas, and Vercel. It enables dynamic image/text-based card management with features like user voting, ranking, and comprehensive leaderboard functionality. Built for seamless deployment on Vercel, it provides an enterprise-grade platform for HR management and frame-based content organization.

## 📑 Documentation

- [Architecture](./ARCHITECTURE.md) - System design and components
- [API Documentation](./API.md) - API endpoints and usage
- [Roadmap](./ROADMAP.md) - Development phases and milestones
- [Task List](./TASKLIST.md) - Current development progress
- [Release Notes](./RELEASE_NOTES.md) - Version history and changes

## 🕵️ Anonymous User Documentation

NARIMATO provides a sophisticated anonymous user system that enables immediate platform engagement without registration barriers. This feature is designed to enhance accessibility while maintaining security and performance.

### Key Features

- **Instant Access**:
  - Automatic session creation for new visitors
  - UUID-based identification system
  - 30-day session persistence
  - Secure cookie-based session management

- **Available Features**:
  - Browse all public projects and cards
  - View project details and card content
  - Participate in card voting (rate-limited)
  - Access basic platform features

- **Security & Privacy**:
  - Rate limiting: 50 votes/hour per session
  - IP-based abuse prevention
  - Minimal data collection
  - No personally identifiable information stored
  - Automatic session cleanup

- **Upgrade Path**:
  - Strategic upgrade prompts
  - One-click account creation
  - Activity preservation during upgrade
  - Seamless transition to full features

### Limitations

- No content creation capabilities
- No project management features
- Rate-limited voting system
- Public content access only

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

### Example Usage

Here's a quick example of how to use the NARIMATO platform to create and manage a card:

1. **Create a New Card**:
   - Navigate to the card creation interface.
   - Fill in the necessary details: type, content, hashtags, and optional image.
2. **Interact with Cards**:
   - Use the swipe or vote system to engage with cards.
   - Check real-time updates in the leaderboard for card rankings.
3. **Manage Projects**:
   - Organize cards within projects and manage settings like visibility and order.

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
2. Install dependencies: `yarn install`
3. Set up environment variables:
   ```env
   MONGO_URI=your_mongodb_atlas_uri
   IMGBB_API_KEY=your_imgbb_api_key
   VERCEL_ENV=development
   ```
4. Run development server: `yarn dev`
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
