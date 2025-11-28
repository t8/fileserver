import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'database.sqlite');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  uploadDir: UPLOAD_DIR,
  dbPath: DB_PATH,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10), // 10GB default
  allowedMimeTypes: [
    // Video
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/webm',
    // Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    // Image
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
  ],
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
};

