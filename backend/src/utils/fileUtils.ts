import path from 'path';
import fs from 'fs';
import { config } from '../config';

export function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  return filename
    .replace(/[\/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .trim();
}

export function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const base = path.basename(originalFilename, ext);
  const sanitized = sanitizeFilename(base);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${sanitized}_${timestamp}_${random}${ext}`;
}

export function isValidMimeType(mimeType: string): boolean {
  return config.allowedMimeTypes.includes(mimeType);
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function ensureUploadDir(): void {
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

