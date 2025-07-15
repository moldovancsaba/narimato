import { Request, Response, NextFunction } from 'express';
import { UserRole, UserSession } from '../types/auth';
import { SessionService } from '../services/SessionService';

const sessionService = new SessionService();

/**
 * Middleware to ensure a valid session exists or create an anonymous one
 */
export const ensureSession = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.cookies?.sessionId;
  let session = sessionId ? sessionService.getSession(sessionId) : null;

  if (!session) {
    session = sessionService.createAnonymousSession();
    res.cookie('sessionId', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  } else {
    sessionService.touchSession(session.id);
  }

  req.session = session;
  next();
};

/**
 * Factory function to create role-based access control middleware
 */
export const requireRole = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = req.session;

    if (!session) {
      return res.status(401).json({ error: 'No session found' });
    }

    // Role hierarchy check (GUEST < USER < ADMIN)
    const roleHierarchy = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.ADMIN]: 2
    };

    if (roleHierarchy[session.role] < roleHierarchy[requiredRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Middleware to require authentication (any role except GUEST)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session = req.session;

  if (!session || session.isAnonymous) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
};

/**
 * Middleware to handle admin dashboard access
 */
export const requireAdmin = [
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    // Additional admin-specific security checks could go here
    next();
  }
];
