import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getDatabase } from '../db/database';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as {
      id: number;
      username: string;
      password_hash: string;
    } | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate simple token (userId:username)
    // In production, use JWT
    const token = `${user.id}:${user.username}`;

    res.json({
      token,
      userId: user.id,
      username: user.username
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

