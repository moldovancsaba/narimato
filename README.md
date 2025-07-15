# NARIMATO 🎴 ![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

NARIMATO is a real-time, card-based web application built with Next.js, MongoDB Atlas, and Vercel. It enables dynamic image/text-based card management with features like user voting, ranking, and comprehensive leaderboard functionality. Built for seamless deployment on Vercel, it provides an enterprise-grade platform for HR management and frame-based content organization.

## 📑 Documentation

- [Architecture](./ARCHITECTURE.md) - System design and components
- [Roadmap](./ROADMAP.md) - Development phases and milestones
- [Task List](./TASKLIST.md) - Current development progress
- [Release Notes](./RELEASE_NOTES.md) - Version history and changes

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
- Card voting and ranking system

## 🌐 Deployment

Deployment is automated via Vercel with the following flow:
1. Commits to `dev` -> Development environment
2. Merges to `staging` -> Staging environment
3. Merges to `main` -> Production environment
