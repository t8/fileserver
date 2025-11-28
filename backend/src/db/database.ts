import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { config } from '../config';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure database directory exists
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Execute schema - create tables
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Folders table
    CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_folder_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE(name, parent_folder_id)
    );

    -- Files table (without new columns for migration compatibility)
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- File versions table
    CREATE TABLE IF NOT EXISTS file_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id),
        UNIQUE(file_id, version_number)
    );
  `;
  db.exec(schema);

  // Migrate existing database - add new columns if they don't exist
  try {
    // Check if folder_id column exists
    const tableInfo = db.prepare("PRAGMA table_info(files)").all() as Array<{ name: string }>;
    const hasFolderId = tableInfo.some(col => col.name === 'folder_id');
    const hasCurrentVersion = tableInfo.some(col => col.name === 'current_version');

    if (!hasFolderId) {
      db.prepare('ALTER TABLE files ADD COLUMN folder_id INTEGER').run();
      // Add foreign key constraint separately
      db.prepare('CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)').run();
    }

    if (!hasCurrentVersion) {
      db.prepare('ALTER TABLE files ADD COLUMN current_version INTEGER DEFAULT 1').run();
    }

    // Add foreign key for folder_id if it was just added
    if (!hasFolderId) {
      // SQLite doesn't support adding foreign keys via ALTER TABLE easily
      // We'll rely on application-level enforcement for existing databases
    }
  } catch (e: any) {
    console.error('Migration error:', e);
    // Continue anyway
  }

  // Create indexes (safe to run multiple times)
  const indexes = `
    CREATE INDEX IF NOT EXISTS idx_files_original_filename ON files(original_filename);
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_folder_id);
    CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
  `;
  db.exec(indexes);

  // Initialize default users if they don't exist (async, non-blocking)
  initializeDefaultUsers(db).catch(err => {
    console.error('Error initializing default users:', err);
  });

  return db;
}

async function initializeDefaultUsers(db: Database.Database) {
  const users = [
    { username: 'jonah', password: 'MleepSheep' },
    { username: 'steven', password: 'MleepSheep' },
    { username: 'spencer', password: 'MleepSheep' },
    { username: 'tatef', password: 'MleepSheep' },
  ];

  for (const user of users) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
    const passwordHash = await bcrypt.hash(user.password, 10);
    
    if (!existing) {
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(user.username, passwordHash);
      console.log(`Initialized user: ${user.username}`);
    } else {
      // Update password for existing user to ensure it's correct
      db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, user.username);
      console.log(`Updated password for user: ${user.username}`);
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

