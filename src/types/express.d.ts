import { UserSession } from './auth';

declare global {
  namespace Express {
    interface Request {
      session?: UserSession;
    }
  }
}
