import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { UserSession } from '@/models/UserSession';

export type User = {
  type: 'anonymous' | 'authenticated';
  sessionId: string;
  // Additional fields for authenticated users can be added here
};

/**
 * Get the current user from the request context
 * If no session exists, creates a new anonymous session
 */
export async function getCurrentUser(): Promise<User> {
  const headersList = headers();
  let sessionId = headersList.get('session-id');

  // If no session ID exists, create a new one
  if (!sessionId) {
    sessionId = uuidv4();
    // Create a new session in the database
    await UserSession.create({ sessionId });
  } else {
    // Validate and touch the existing session
    const session = await UserSession.findOne({ sessionId });
    if (!session) {
      // Session not found in DB, create a new one
      sessionId = uuidv4();
      await UserSession.create({ sessionId });
    }
  }

  // For now, all users are anonymous since we don't have authentication yet
  return {
    type: 'anonymous',
    sessionId
  };
}

/**
 * Middleware function to handle authentication
 * Currently only handles anonymous sessions, but can be extended for authenticated users
 */
export async function authMiddleware(request: NextRequest) {
  let sessionId = request.headers.get('session-id');

  if (!sessionId) {
    // Generate a new session ID for anonymous users
    sessionId = uuidv4();
    await UserSession.create({ sessionId });
  }

  // Clone the request headers to add the session ID
  const headers = new Headers(request.headers);
  headers.set('session-id', sessionId);

  // Return modified request with session ID
  return new NextRequest(request.url, {
    ...request,
    headers
  });
}
