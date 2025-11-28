# File Server Web Application

A production-ready file hosting web application with a Dropbox-like UI. Supports file upload, download, search, and user authentication.

## Features

- **File Upload**: Upload video, audio, and image files
- **File Download**: Download files with authentication
- **File Search**: Search files by name
- **User Authentication**: Secure login and registration
- **Modern UI**: Clean, responsive interface similar to Dropbox/Google Drive

## Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Username/password with bcrypt

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install:all
   ```
   Or manually:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (port, paths, etc.)

### Running the Application

#### Development Mode

1. Start the backend server:
   ```bash
   npm run dev:backend
   ```
   Backend runs on `http://localhost:3000`

2. In a separate terminal, start the frontend:
   ```bash
   npm run dev:frontend
   ```
   Frontend runs on `http://localhost:5173`

#### Production Mode

1. Build the backend:
   ```bash
   npm run build:backend
   ```

2. Build the frontend:
   ```bash
   npm run build:frontend
   ```

3. Start the backend server:
   ```bash
   npm run start:backend
   ```

4. Serve the frontend build (you can use a static file server or serve it through the backend)

## Environment Variables

See `.env.example` for all available configuration options:

- `PORT`: Backend server port (default: 3000)
- `DATABASE_PATH`: Path to SQLite database file
- `UPLOAD_DIR`: Directory for uploaded files
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 10GB)
- `SESSION_SECRET`: Secret for session management
- `VITE_API_URL`: Frontend API URL (for production builds)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Files
- `POST /api/files/upload` - Upload files (requires authentication)
- `GET /api/files/list` - List all files (requires authentication)
- `GET /api/files/search?q=query` - Search files by name (requires authentication)
- `GET /api/files/download/:id` - Download file by ID (requires authentication)

## Deployment

1. Set environment variables on your server
2. Build both backend and frontend
3. Run the backend server on your specified port
4. Serve the frontend build (can be integrated with backend or served separately)

The application is designed to be easily deployable with a configurable port.

## Security Considerations

- Passwords are hashed using bcrypt
- File type validation (only video, audio, image files)
- File size limits
- Secure file paths (directory traversal prevention)
- Authentication required for all file operations
- CORS configuration

## License

ISC