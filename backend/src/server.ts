import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

// Serve frontend static files in production
// Try multiple possible paths for frontend dist
const possiblePaths = [
  path.join(process.cwd(), 'frontend', 'dist'), // Development/production from project root
  path.join(__dirname, '..', '..', 'frontend', 'dist'), // Production from backend/dist
  path.join(process.cwd(), '..', 'frontend', 'dist'), // Alternative path
];

let frontendDist: string | null = null;
for (const distPath of possiblePaths) {
  if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
    frontendDist = distPath;
    break;
  }
}

if (frontendDist) {
  console.log(`Serving frontend from: ${frontendDist}`);
  
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(frontendDist, { index: false }));
  
  // Explicitly handle root route
  app.get('/', (req, res) => {
    res.sendFile(path.resolve(frontendDist!, 'index.html'));
  });
  
  // Handle React Router - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes and uploads - let them fall through to 404 if not handled
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    // Serve index.html for all other routes (React Router will handle routing)
    const indexPath = path.resolve(frontendDist!, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending index.html:', err);
        res.status(500).send('Error loading frontend');
      }
    });
  });
} else {
  console.log('Frontend dist folder not found. API-only mode.');
  console.log('Searched paths:', possiblePaths);
  // In API-only mode, return 404 for root
  app.get('/', (req, res) => {
    res.status(404).json({ error: 'Frontend not found. Please build the frontend first.' });
  });
}

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

