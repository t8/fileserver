import bcrypt from 'bcrypt';
import { getDatabase } from '../db/database';

const users = [
  { username: 'jonah', password: 'MleepSheep' },
  { username: 'steven', password: 'MleepSheep' },
  { username: 'spencer', password: 'MleepSheep' },
  { username: 'tatef', password: 'MleepSheep' },
];

async function initUsers() {
  const db = getDatabase();

  for (const user of users) {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    
    // Hash password
    const passwordHash = await bcrypt.hash(user.password, 10);

    if (existing) {
      // Update existing user's password
      db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, user.username);
      console.log(`Updated password for user: ${user.username}`);
    } else {
      // Create new user
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(user.username, passwordHash);
      console.log(`Created user: ${user.username} (ID: ${result.lastInsertRowid})`);
    }
  }

  console.log('User initialization complete!');
  process.exit(0);
}

initUsers().catch((error) => {
  console.error('Error initializing users:', error);
  process.exit(1);
});

