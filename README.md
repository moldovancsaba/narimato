<<<<<<< HEAD
# Narimato

A Next.js application for frame-it-now platform with support for HR management.

This project is bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
# NARIMATO 🎴

NARIMATO is a real-time, card-based web application built with Next.js, MongoDB Atlas, and Vercel. It enables dynamic image/text-based card management with features like user voting, ranking, and comprehensive leaderboard functionality.

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
>>>>>>> dev
