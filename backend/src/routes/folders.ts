import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { getDatabase } from '../db/database';
import { sanitizeFilename } from '../utils/fileUtils';

const router = Router();

// Create folder
router.post('/create', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { name, parentFolderId } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const sanitizedName = sanitizeFilename(name.trim());
    if (sanitizedName.length === 0) {
      return res.status(400).json({ error: 'Invalid folder name' });
    }

    const db = getDatabase();
    const parentId = parentFolderId ? parseInt(parentFolderId, 10) : null;

    // Validate parent folder exists if provided
    if (parentId) {
      const parent = db.prepare('SELECT id FROM folders WHERE id = ?').get(parentId);
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
    }

    // Check if folder with same name already exists in parent
    const existing = db
      .prepare('SELECT id FROM folders WHERE name = ? AND (parent_folder_id = ? OR (parent_folder_id IS NULL AND ? IS NULL))')
      .get(sanitizedName, parentId, parentId);

    if (existing) {
      return res.status(400).json({ error: 'Folder with this name already exists' });
    }

    const result = db
      .prepare('INSERT INTO folders (name, parent_folder_id, created_by) VALUES (?, ?, ?)')
      .run(sanitizedName, parentId, req.userId!);

    res.status(201).json({
      id: result.lastInsertRowid,
      name: sanitizedName,
      parentFolderId: parentId,
      message: 'Folder created successfully',
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List folders and files in a folder
router.get('/contents/:folderId?', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const folderId = req.params.folderId ? parseInt(req.params.folderId, 10) : null;

    if (folderId && isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
    }

    const db = getDatabase();

    // Validate folder exists if folderId provided
    if (folderId) {
      const folder = db.prepare('SELECT id, name FROM folders WHERE id = ?').get(folderId) as {
        id: number;
        name: string;
      } | undefined;
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    // Get subfolders
    const folders = db
      .prepare('SELECT f.id, f.name, f.created_at, u.username as created_by_username FROM folders f JOIN users u ON f.created_by = u.id WHERE f.parent_folder_id = ? OR (f.parent_folder_id IS NULL AND ? IS NULL) ORDER BY f.name')
      .all(folderId, folderId) as Array<{
      id: number;
      name: string;
      created_at: string;
      created_by_username: string;
    }>;

    // Get files
    const files = db
      .prepare(
        'SELECT f.id, f.original_filename, f.file_size, f.mime_type, f.uploaded_at, f.current_version, u.username as uploaded_by_username FROM files f JOIN users u ON f.uploaded_by = u.id WHERE f.folder_id = ? OR (f.folder_id IS NULL AND ? IS NULL) ORDER BY f.uploaded_at DESC'
      )
      .all(folderId, folderId) as Array<{
      id: number;
      original_filename: string;
      file_size: number;
      mime_type: string;
      uploaded_at: string;
      current_version: number;
      uploaded_by_username: string;
    }>;

    res.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.created_at,
        createdBy: f.created_by_username,
      })),
      files: files.map((f) => ({
        id: f.id,
        filename: f.original_filename,
        size: f.file_size,
        mimeType: f.mime_type,
        uploadedAt: f.uploaded_at,
        currentVersion: f.current_version,
        uploadedBy: f.uploaded_by_username,
      })),
    });
  } catch (error) {
    console.error('List folder contents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get folder path (breadcrumbs)
router.get('/path/:folderId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const folderId = parseInt(req.params.folderId, 10);
    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
    }

    const db = getDatabase();
    const path: Array<{ id: number; name: string }> = [];

    let currentId: number | null = folderId;
    while (currentId) {
      const folder = db.prepare('SELECT id, name, parent_folder_id FROM folders WHERE id = ?').get(currentId) as {
        id: number;
        name: string;
        parent_folder_id: number | null;
      } | undefined;

      if (!folder) break;

      path.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parent_folder_id;
    }

    res.json({ path });
  } catch (error) {
    console.error('Get folder path error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete folder
router.delete('/:folderId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const folderId = parseInt(req.params.folderId, 10);
    if (isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid folder ID' });
    }

    const db = getDatabase();
    const folder = db.prepare('SELECT id, created_by FROM folders WHERE id = ?').get(folderId) as {
      id: number;
      created_by: number;
    } | undefined;

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Only allow creator to delete (or admin in future)
    if (folder.created_by !== req.userId) {
      return res.status(403).json({ error: 'You can only delete folders you created' });
    }

    db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

