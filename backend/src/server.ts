import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { config } from './config';
import { getDatabase, closeDatabase } from './db/database';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folders';
import versionRoutes from './routes/versions';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
getDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/versions', versionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve uploaded files statically (optional, for direct access)
app.use('/uploads', express.static(config.uploadDir));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  closeDatabase();
  process.exit(0);
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${config.uploadDir}`);
  console.log(`Database: ${config.dbPath}`);
});

