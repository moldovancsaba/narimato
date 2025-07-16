import { getAuthSession } from '@/app/api/auth/[...nextauth]/route';
import { AuthenticationError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Define session data types
export type AuthSession = {
  user?: {
    id: string;
    email: string;
  };
  isAnonymous: boolean;
  sessionId: string;
};

/**
 * Creates a new anonymous session with a unique ID
 */
async function createAnonymousSession(): Promise<AuthSession> {
  return {
    isAnonymous: true,
    sessionId: crypto.randomUUID(),
  };
}

/**
 * Gets the current session from the request, or creates a new anonymous one
 */
export async function getOrCreateSession(req: NextRequest): Promise<AuthSession> {
  // Try to get existing auth session
  const authSession = await getAuthSession();

  // If we have a valid authenticated session, return it
  if (authSession?.user?.id && authSession?.user?.email) {
    return {
      user: {
        id: authSession.user.id,
        email: authSession.user.email
      },
      isAnonymous: false,
      sessionId: authSession.user.id,
    };
  }

  // Try to get existing anonymous session from request cookies
  const anonSessionId = req.cookies.get('anonymousSession')?.value;
  if (anonSessionId) {
    return {
      isAnonymous: true,
      sessionId: anonSessionId,
    };
  }

  // Create new anonymous session
  const anonymousSession = await createAnonymousSession();
  
  // Set cookie for anonymous session
  const response = new Response();
  response.headers.set(
    'Set-Cookie',
    `anonymousSession=${anonymousSession.sessionId}; HttpOnly; Path=/; SameSite=Lax`
  );

  return anonymousSession;
}

/**
 * Middleware to handle authentication - allows both authenticated and anonymous sessions
 * @param req The Next.js request object
 * @param requireAuth Whether to require authenticated users (defaults to false)
 * @returns The session object (either authenticated or anonymous)
 */
export async function requireAuth(
  req: NextRequest,
  requireAuth: boolean = false
): Promise<AuthSession> {
  const session = await getOrCreateSession(req);

  // If authentication is required and we have an anonymous session
  if (requireAuth && session.isAnonymous) {
    throw new AuthenticationError('Authentication required');
  }

  return session;
}

/**
 * Helper to check if a session is authenticated
 */
export function isAuthenticated(session: AuthSession): session is AuthSession & { user: NonNullable<AuthSession['user']> } {
  return !session.isAnonymous && !!session.user;
}
