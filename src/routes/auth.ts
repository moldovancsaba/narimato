import { Router, Request, Response } from 'express';
import { ensureSession, requireAuth, requireAdmin } from '../middleware/auth';
import { SessionService } from '../services/SessionService';
import { UserRole, UserPreferences } from '../types/auth';

const router = Router();
const sessionService = new SessionService();

// Apply session management to all routes
router.use(ensureSession);

// Public route - accessible to all users including anonymous
router.get('/session', (req, res) => {
  res.json({ session: req.session });
});

// Protected route - requires authentication
router.get('/profile', requireAuth, (req, res) => {
  res.json({ 
    message: 'Profile accessed successfully',
    session: req.session 
  });
});

// Admin only route
router.get('/admin/dashboard', requireAdmin, (req: Request, res: Response) => {
  res.json({
    message: 'Admin dashboard accessed successfully',
    session: req.session
  });
});

// Update user preferences
router.put('/preferences', requireAuth, (req, res) => {
  const preferences: UserPreferences = req.body;
  const sessionId = req.session?.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  try {
    sessionService.updateSessionPreferences(sessionId, preferences);
    res.json({ 
      message: 'Preferences updated successfully',
      preferences: sessionService.getSession(sessionId)?.preferences
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Logout - destroy session
router.post('/logout', (req, res) => {
  const sessionId = req.session?.id;
  if (sessionId) {
    sessionService.destroySession(sessionId);
    res.clearCookie('sessionId');
  }
  res.json({ message: 'Logged out successfully' });
});

export default router;
