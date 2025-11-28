import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { getDatabase } from '../db/database';
import { config } from '../config';
import { generateUniqueFilename, isValidMimeType, sanitizeFilename, ensureUploadDir } from '../utils/fileUtils';

const router = Router();

// Ensure upload directory exists
ensureUploadDir();

// Configure multer for version uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (isValidMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Only video, audio, and image files are permitted.`));
    }
  },
});

// Upload new version of a file
router.post('/upload/:fileId', requireAuth, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = getDatabase();

    // Check original file exists
    const originalFile = db.prepare('SELECT id, original_filename, uploaded_by FROM files WHERE id = ?').get(fileId) as {
      id: number;
      original_filename: string;
      uploaded_by: number;
    } | undefined;

    if (!originalFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get current max version number
    const maxVersion = db.prepare('SELECT MAX(version_number) as max FROM file_versions WHERE file_id = ?').get(fileId) as {
      max: number | null;
    } | undefined;

    // Get current version from files table as starting point
    const currentFile = db.prepare('SELECT current_version FROM files WHERE id = ?').get(fileId) as {
      current_version: number;
    } | undefined;

    const currentVersion = currentFile?.current_version || 0;
    const maxVersionNum = maxVersion?.max || currentVersion;
    const nextVersion = Math.max(maxVersionNum, currentVersion) + 1;

    // Insert new version
    const result = db
      .prepare(
        'INSERT INTO file_versions (file_id, version_number, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?)'
      )
      .run(fileId, nextVersion, req.file.path, req.file.size, req.userId!);

    // Update current version in files table
    db.prepare('UPDATE files SET current_version = ? WHERE id = ?').run(nextVersion, fileId);

    res.status(201).json({
      message: 'Version uploaded successfully',
      version: {
        id: result.lastInsertRowid,
        versionNumber: nextVersion,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Upload version error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List versions of a file
router.get('/:fileId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const db = getDatabase();

    // Check file exists
    const file = db.prepare('SELECT id, original_filename, current_version FROM files WHERE id = ?').get(fileId) as {
      id: number;
      original_filename: string;
      current_version: number;
    } | undefined;

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get all versions
    const versions = db
      .prepare(
        'SELECT v.id, v.version_number, v.file_size, v.uploaded_at, u.username as uploaded_by_username FROM file_versions v JOIN users u ON v.uploaded_by = u.id WHERE v.file_id = ? ORDER BY v.version_number DESC'
      )
      .all(fileId) as Array<{
      id: number;
      version_number: number;
      file_size: number;
      uploaded_at: string;
      uploaded_by_username: string;
    }>;

    res.json({
      fileId: file.id,
      filename: file.original_filename,
      currentVersion: file.current_version,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.version_number,
        fileSize: v.file_size,
        uploadedAt: v.uploaded_at,
        uploadedBy: v.uploaded_by_username,
        isCurrent: v.version_number === file.current_version,
      })),
    });
  } catch (error) {
    console.error('List versions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore a version (make it current)
router.post('/restore/:fileId/:versionNumber', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);

    if (isNaN(fileId) || isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Invalid file ID or version number' });
    }

    const db = getDatabase();

    // Check file exists
    const file = db.prepare('SELECT id, uploaded_by FROM files WHERE id = ?').get(fileId) as {
      id: number;
      uploaded_by: number;
    } | undefined;

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check version exists
    const version = db
      .prepare('SELECT id, version_number FROM file_versions WHERE file_id = ? AND version_number = ?')
      .get(fileId, versionNumber) as {
      id: number;
      version_number: number;
    } | undefined;

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Update current version
    db.prepare('UPDATE files SET current_version = ? WHERE id = ?').run(versionNumber, fileId);

    res.json({ message: 'Version restored successfully', currentVersion: versionNumber });
  } catch (error) {
    console.error('Restore version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download a specific version
router.get('/download/:fileId/:versionNumber', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);

    if (isNaN(fileId) || isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Invalid file ID or version number' });
    }

    const db = getDatabase();

    // Get file info
    const file = db.prepare('SELECT id, original_filename FROM files WHERE id = ?').get(fileId) as {
      id: number;
      original_filename: string;
    } | undefined;

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get version info
    const version = db
      .prepare('SELECT id, file_path, file_size FROM file_versions WHERE file_id = ? AND version_number = ?')
      .get(fileId, versionNumber) as {
      id: number;
      file_path: string;
      file_size: number;
    } | undefined;

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const filePath = version.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Version file not found on disk' });
    }

    // Prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    const uploadDir = path.resolve(config.uploadDir);
    if (!resolvedPath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(file.original_filename)}_v${versionNumber}"`
    );
    res.setHeader('Content-Length', version.file_size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

