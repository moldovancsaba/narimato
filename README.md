# NARIMATO

![Version](https://img.shields.io/badge/version-2.0.3-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.4.4-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)

NARIMATO is an anonymous, session-based card ranking application built with Next.js, MongoDB, and sophisticated binary search ranking algorithms. Global rankings are powered by ELO rating system for accurate skill-based card comparisons.

**Current Version:** 2.0.3 *(Updated with Dark Mode support)*

## ✨ Key Features

- **Binary Search Ranking**: Efficient O(log n) card positioning algorithm
- **Anonymous Sessions**: No user registration required
- **Real-time State Management**: Optimistic locking with automatic conflict resolution
- **Mobile-First Design**: Responsive interface with touch gesture support
- **Dynamic Text Scaling**: Automatic font sizing for optimal readability
- **Modern Typography**: Professional Fira Code SemiBold font for enhanced aesthetics
- **Clean Card Design**: Simplified interface focused on content without title clutter
- **Session Recovery**: Robust error handling and state persistence
  - **Dark Mode Support**: Full dark mode for enhanced visual comfort.
  - **Comprehensive Error Handling**: Graceful degradation and automatic recovery

## 🔥 Recent Improvements (v2.0.2)

- **Typography Enhancement**: Upgraded to Fira Code SemiBold (600) for improved readability
- **Clean UI Design**: Removed title overlays from cards for cleaner, content-focused interface
- **Dynamic Text Fitting**: Advanced text scaling system ensures optimal display across all card sizes
- **Enhanced Binary Search**: Accumulated bounds calculation for optimal comparison efficiency
- **Smart State Transitions**: Automatic detection when card position is determined
- **Improved Session Management**: Perfect synchronization between frontend and backend states
- **Dark Mode Support**: Seamless dark mode experience for improved accessibility.
- **Performance Optimization**: ~40% reduction in average comparisons per card

## 📚 Documentation

- **[📋 Roadmap](./ROADMAP.md)** - Development roadmap with Q1-Q4 2024 plans
- **[✅ Task List](./TASKLIST.md)** - Prioritized implementation tasks and status
- **[📦 Release Notes](./RELEASE_NOTES.md)** - Version history and change log
- **[🏗️ Architecture](./ARCHITECTURE.md)** - System architecture and technical overview
- **[🧠 Learnings](./LEARNINGS.md)** - Development insights and lessons learned

## 🚀 Quick Start

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load fonts. The card components use **Fira Code SemiBold (600)** for enhanced readability and modern aesthetic.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
