# NARIMATO 🎴 ![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)

NARIMATO is a real-time, card-based web application built with Next.js, MongoDB Atlas, and Vercel. It enables dynamic image/text-based card management with features like user voting, ranking, and comprehensive leaderboard functionality. Built for seamless deployment on Vercel, it provides an enterprise-grade platform for HR management and frame-based content organization.

## 📑 Documentation

- [Architecture](./ARCHITECTURE.md) - System design and components
- [API Documentation](./API.md) - API endpoints and usage
- [Roadmap](./ROADMAP.md) - Development phases and milestones
- [Task List](./TASKLIST.md) - Current development progress
- [Release Notes](./RELEASE_NOTES.md) - Version history and changes

## 🔄 Project Management Flows

### Development Workflow

1. **Task Creation & Assignment**
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

- Responsive, mobile-first design
- Dark mode support
- Real-time updates via Socket.io
- Global and project-based leaderboards
- Card voting and ranking system with immediate voting availability
- Streamlined user experience with no voting restrictions

## 🌐 Deployment

Deployment is automated via Vercel with the following flow:
1. Commits to `dev` -> Development environment
2. Merges to `staging` -> Staging environment
3. Merges to `main` -> Production environment
