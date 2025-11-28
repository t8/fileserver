import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  const db = getDatabase();
  
  // Simple token validation - in production, use JWT or proper session management
  // For now, we'll use a simple approach: token is userId:username
  try {
    const [userId, username] = token.split(':');
    const userIdNum = parseInt(userId, 10);
    
    if (isNaN(userIdNum)) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    // Verify user exists
    const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND username = ?').get(userIdNum, username);
    
    if (!user) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    req.userId = userIdNum;
    req.username = username as string;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

