import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Types
interface Card {
  _id: string;
  slug: string;
}

interface Project {
  _id: string;
  slug: string;
}

interface User {
  email: string;
  role: string;
}

// Navigation utilities
export const getCardUrl = (card: Card, isManagement = false) => {
  if (isManagement) {
    return `/manage/cards/${card._id}`;
  }
  return `/cards/${card.slug}`;
};

export const getProjectUrl = (project: Project, isManagement = false) => {
  if (isManagement) {
    return `/manage/projects/${project._id}`;
  }
  return `/projects/${project.slug}`;
};

export const hasManagementAccess = (user: User | null): boolean => {
  if (!user) return false;
  return ['admin', 'manager'].includes(user.role);
};

// Middleware to protect management routes
export async function middleware(request: NextRequest) {
  const isManagementRoute = request.nextUrl.pathname.startsWith("/manage/");
  
  if (isManagementRoute) {
    const session = request.cookies.get('session')?.value;
    if (!session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    try {
      const sessionData = JSON.parse(session);
      const user = sessionData.user;
      
      if (!hasManagementAccess(user)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/manage/:path*"]
};
