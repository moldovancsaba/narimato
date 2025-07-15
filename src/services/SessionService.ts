import { v4 as uuidv4 } from 'uuid';
import { UserRole, UserSession, User, UserPreferences } from '../types/auth';

/**
 * Service responsible for managing user sessions and authentication state
 */
export class SessionService {
  private sessions: Map<string, UserSession>;

  constructor() {
    this.sessions = new Map<string, UserSession>();
  }

  /**
   * Creates a new anonymous session
   */
  public createAnonymousSession(): UserSession {
    const timestamp = new Date().toISOString();
    const session: UserSession = {
      id: uuidv4(),
      role: UserRole.GUEST,
      createdAt: timestamp,
      lastAccessedAt: timestamp,
      isAnonymous: true
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Creates an authenticated user session
   */
  public createUserSession(user: User): UserSession {
    const timestamp = new Date().toISOString();
    const session: UserSession = {
      id: uuidv4(),
      userId: user.id,
      role: user.role,
      createdAt: timestamp,
      lastAccessedAt: timestamp,
      isAnonymous: false,
      preferences: user.preferences
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Updates the last accessed timestamp of a session
   */
  public touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Updates user preferences in the session
   */
  public updateSessionPreferences(sessionId: string, preferences: UserPreferences): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.preferences = { ...session.preferences, ...preferences };
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Retrieves a session by ID
   */
  public getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroys a session
   */
  public destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Cleans up expired sessions (older than 24 hours)
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastAccessed = new Date(session.lastAccessedAt);
      if (now.getTime() - lastAccessed.getTime() > expiryTime) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
