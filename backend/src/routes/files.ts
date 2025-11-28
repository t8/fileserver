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

// Configure multer for file uploads
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

// Upload file
router.post('/upload', requireAuth, upload.array('files', 10), (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = Array.isArray(req.files) ? req.files : [req.files];
    const db = getDatabase();
    const uploadedFiles = [];
    const folderId = req.body.folderId ? parseInt(req.body.folderId, 10) : null;

    // Validate folder exists if provided
    if (folderId) {
      const folder = db.prepare('SELECT id FROM folders WHERE id = ?').get(folderId);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    for (const file of files) {
      // Type assertion: we know files is an array of Express.Multer.File
      const multerFile = file as Express.Multer.File;
      const fileInfo = {
        filename: multerFile.filename,
        originalFilename: sanitizeFilename(multerFile.originalname),
        filePath: multerFile.path,
        fileSize: multerFile.size,
        mimeType: multerFile.mimetype,
        uploadedBy: req.userId!,
        folderId,
      };

      const result = db
        .prepare(
          'INSERT INTO files (filename, original_filename, file_path, file_size, mime_type, folder_id, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          fileInfo.filename,
          fileInfo.originalFilename,
          fileInfo.filePath,
          fileInfo.fileSize,
          fileInfo.mimeType,
          fileInfo.folderId,
          fileInfo.uploadedBy
        );

      uploadedFiles.push({
        id: result.lastInsertRowid,
        filename: fileInfo.originalFilename,
        size: fileInfo.fileSize,
        mimeType: fileInfo.mimeType,
        uploadedAt: new Date().toISOString(),
      });
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List all files
router.get('/list', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    const files = db
      .prepare(
        'SELECT f.id, f.original_filename, f.file_size, f.mime_type, f.uploaded_at, u.username as uploaded_by_username FROM files f JOIN users u ON f.uploaded_by = u.id ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?'
      )
      .all(limit, offset) as Array<{
        id: number;
        original_filename: string;
        file_size: number;
        mime_type: string;
        uploaded_at: string;
        uploaded_by_username: string;
      }>;

    const totalResult = db.prepare('SELECT COUNT(*) as total FROM files').get() as { total: number };
    const total = totalResult.total;

    res.json({
      files: files.map((f) => ({
        id: f.id,
        filename: f.original_filename,
        size: f.file_size,
        mimeType: f.mime_type,
        uploadedAt: f.uploaded_at,
        uploadedBy: f.uploaded_by_username,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search files
router.get('/search', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = `%${query.trim()}%`;
    const db = getDatabase();
    const files = db
      .prepare(
        'SELECT f.id, f.original_filename, f.file_size, f.mime_type, f.uploaded_at, u.username as uploaded_by_username FROM files f JOIN users u ON f.uploaded_by = u.id WHERE f.original_filename LIKE ? ORDER BY f.uploaded_at DESC'
      )
      .all(searchTerm) as Array<{
        id: number;
        original_filename: string;
        file_size: number;
        mime_type: string;
        uploaded_at: string;
        uploaded_by_username: string;
      }>;

    res.json({
      files: files.map((f) => ({
        id: f.id,
        filename: f.original_filename,
        size: f.file_size,
        mimeType: f.mime_type,
        uploadedAt: f.uploaded_at,
        uploadedBy: f.uploaded_by_username,
      })),
      query,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file
router.get('/download/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const db = getDatabase();
    const file = db
      .prepare('SELECT id, filename, original_filename, file_path, file_size, mime_type FROM files WHERE id = ?')
      .get(fileId) as {
      id: number;
      filename: string;
      original_filename: string;
      file_path: string;
      file_size: number;
      mime_type: string;
    } | undefined;

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = file.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    const uploadDir = path.resolve(config.uploadDir);
    if (!resolvedPath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(file.original_filename)}"`);
    res.setHeader('Content-Length', file.file_size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move file to folder
router.patch('/move/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const { folderId } = req.body;
    const targetFolderId = folderId ? parseInt(folderId, 10) : null;

    if (folderId && isNaN(targetFolderId!)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
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

    // Only allow owner to move
    if (file.uploaded_by !== req.userId) {
      return res.status(403).json({ error: 'You can only move files you uploaded' });
    }

    // Validate target folder exists if provided
    if (targetFolderId) {
      const folder = db.prepare('SELECT id FROM folders WHERE id = ?').get(targetFolderId);
      if (!folder) {
        return res.status(404).json({ error: 'Target folder not found' });
      }
    }

    // Update file folder
    db.prepare('UPDATE files SET folder_id = ? WHERE id = ?').run(targetFolderId, fileId);

    res.json({ message: 'File moved successfully' });
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total storage statistics
router.get('/stats', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    
    // Get total size from all files
    const filesResult = db.prepare('SELECT SUM(file_size) as total FROM files').get() as {
      total: number | null;
    };
    
    // Get total size from all file versions
    const versionsResult = db.prepare('SELECT SUM(file_size) as total FROM file_versions').get() as {
      total: number | null;
    };
    
    const filesTotal = filesResult.total || 0;
    const versionsTotal = versionsResult.total || 0;
    const totalStorage = filesTotal + versionsTotal;
    
    // Get file count
    const fileCountResult = db.prepare('SELECT COUNT(*) as count FROM files').get() as {
      count: number;
    };
    
    res.json({
      totalStorage,
      filesTotal,
      versionsTotal,
      fileCount: fileCountResult.count,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

