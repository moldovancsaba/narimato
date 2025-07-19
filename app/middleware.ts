import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Session, User } from "../types/next-auth"

// Types
interface Card {
  _id: string
  slug: string
}

interface Project {
  _id: string
  slug: string
}

// Navigation utilities
export const getCardUrl = (card: Card, isManagement = false) => {
  if (isManagement) {
    return `/manage/cards/${card._id}`
  }
  return `/cards/${card.slug}`
}

export const getProjectUrl = (project: Project, isManagement = false) => {
  if (isManagement) {
    return `/manage/projects/${project._id}`
  }
  return `/projects/${project.slug}`
}

export const hasManagementAccess = (user: User | null): boolean => {
  if (!user) return false;
  return ['admin', 'manager'].includes(user.role);
}

// Middleware to protect management routes
export async function middleware(request: NextRequest) {
  const isManagementRoute = request.nextUrl.pathname.startsWith("/manage/")
  
  // TODO: Implement new auth check here
  if (isManagementRoute) {
    // For now, redirect to signin for any management route access
    return NextResponse.redirect(new URL("/auth/signin", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/manage/:path*"]
}
