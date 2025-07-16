import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface SessionUser {
  id: string;
  role: 'admin' | 'user';
  email?: string;
  name?: string;
}

export interface Session {
  id: string;
  user?: SessionUser;
  anonymousId?: string;
  createdAt: string; // ISO 8601 timestamp
  lastActive: string; // ISO 8601 timestamp
  deviceInfo: {
    userAgent: string;
    ip: string;
    location?: string;
  };
}

const SESSION_COOKIE_NAME = 'narimato-session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export async function getOrCreateSession(req: NextRequest): Promise<Session> {
  const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      // Update last active timestamp
      session.lastActive = new Date().toISOString();
      return session;
    }
  }

  // Create new anonymous session
  const now = new Date().toISOString();
  const session: Session = {
    id: uuidv4(),
    anonymousId: uuidv4(),
    createdAt: now,
    lastActive: now,
    deviceInfo: {
      userAgent: req.headers.get('user-agent') || 'unknown',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown'
    }
  };

  // Set session cookie
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: session.id,
    expires: new Date(Date.now() + SESSION_DURATION),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return session;
}

export function getSessionId(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE_NAME);
}

export async function upgradeSession(sessionId: string, user: SessionUser): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  session.user = user;
  session.lastActive = new Date().toISOString();

  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  // TODO: Implement database lookup
  // For now, we'll return null to force new session creation
  return null;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    session.lastActive = new Date().toISOString();
    // TODO: Implement database update
  }
}
