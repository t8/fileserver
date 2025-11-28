import { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import FolderList from '../components/FolderList';
import FileUpload from '../components/FileUpload';
import SearchBar from '../components/SearchBar';
import Breadcrumbs from '../components/Breadcrumbs';
import CreateFolder from '../components/CreateFolder';
import MoveFileDialog from '../components/MoveFileDialog';
import VersionHistory from '../components/VersionHistory';
import StorageIndicator from '../components/StorageIndicator';
import api from '../services/api';

export interface Folder {
  id: number;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface File {
  id: number;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  currentVersion?: number;
}

export default function Dashboard() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number; name: string }>>([]);
  const [moveFileId, setMoveFileId] = useState<number | null>(null);
  const [moveFileName, setMoveFileName] = useState<string>('');
  const [versionFileId, setVersionFileId] = useState<number | null>(null);
  const [versionFileName, setVersionFileName] = useState<string>('');
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const loadFolderContents = async (folderId: number | null = null) => {
    try {
      setLoading(true);
      setError('');
      const endpoint = folderId ? `/folders/contents/${folderId}` : '/folders/contents';
      const response = await api.get(endpoint);
      setFolders(response.data.folders || []);
      setFiles(response.data.files || []);

      // Load breadcrumbs if in a folder
      if (folderId) {
        const pathResponse = await api.get(`/folders/path/${folderId}`);
        setBreadcrumbs(pathResponse.data.path || []);
      } else {
        setBreadcrumbs([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load contents');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (query?: string) => {
    try {
      setLoading(true);
      setError('');
      const endpoint = query ? `/files/search?q=${encodeURIComponent(query)}` : '/files/list';
      const response = await api.get(endpoint);
      setFiles(response.data.files || []);
      setFolders([]); // Clear folders when searching
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      loadFiles(searchQuery);
    } else {
      loadFolderContents(currentFolderId);
    }
  }, [currentFolderId]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      loadFiles(query);
    } else {
      loadFolderContents(currentFolderId);
    }
  };

  const handleFolderClick = (folderId: number) => {
    setCurrentFolderId(folderId);
    setSearchQuery(''); // Clear search when navigating
  };

  const handleNavigate = (folderId: number | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery(''); // Clear search when navigating
  };

  const [storageKey, setStorageKey] = useState(0);

  const handleUploadSuccess = () => {
    setStorageKey(prev => prev + 1); // Trigger storage refresh
    if (searchQuery.trim()) {
      loadFiles(searchQuery);
    } else {
      loadFolderContents(currentFolderId);
    }
  };

  const handleMoveFile = (fileId: number) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setMoveFileId(fileId);
      setMoveFileName(file.filename);
    }
  };

  const handleShowVersions = (fileId: number) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setVersionFileId(fileId);
      setVersionFileName(file.filename);
    }
  };

  const handleMoveSuccess = () => {
    setStorageKey(prev => prev + 1); // Trigger storage refresh
    if (searchQuery.trim()) {
      loadFiles(searchQuery);
    } else {
      loadFolderContents(currentFolderId);
    }
  };

  const handleVersionRestored = () => {
    setStorageKey(prev => prev + 1); // Trigger storage refresh
    if (searchQuery.trim()) {
      loadFiles(searchQuery);
    } else {
      loadFolderContents(currentFolderId);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>File Server</h1>
        <div className="header-actions">
          <StorageIndicator refreshTrigger={storageKey} />
          <span className="username">Welcome, {user?.username}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="dashboard-toolbar">
          <div className="toolbar-left">
            <SearchBar onSearch={handleSearch} />
            {!searchQuery && <CreateFolder parentFolderId={currentFolderId} onSuccess={() => loadFolderContents(currentFolderId)} />}
          </div>
          <div className="toolbar-right">
            <FileUpload onUploadSuccess={handleUploadSuccess} folderId={currentFolderId} />
          </div>
        </div>
        {!searchQuery && breadcrumbs.length > 0 && (
          <Breadcrumbs path={breadcrumbs} onNavigate={handleNavigate} />
        )}
        {error && <div className="error-banner">{error}</div>}
        {searchQuery ? (
          <FolderList
            folders={[]}
            files={files}
            loading={loading}
            onFolderClick={handleFolderClick}
            onRefresh={() => loadFiles(searchQuery)}
            onMoveFile={handleMoveFile}
            onShowVersions={handleShowVersions}
          />
        ) : (
          <FolderList
            folders={folders}
            files={files}
            loading={loading}
            onFolderClick={handleFolderClick}
            onRefresh={() => loadFolderContents(currentFolderId)}
            onMoveFile={handleMoveFile}
            onShowVersions={handleShowVersions}
          />
        )}
        {moveFileId !== null && (
          <MoveFileDialog
            fileId={moveFileId}
            fileName={moveFileName}
            currentFolderId={currentFolderId}
            onClose={() => {
              setMoveFileId(null);
              setMoveFileName('');
            }}
            onSuccess={handleMoveSuccess}
          />
        )}
        {versionFileId !== null && (
          <VersionHistory
            fileId={versionFileId}
            fileName={versionFileName}
            onClose={() => {
              setVersionFileId(null);
              setVersionFileName('');
            }}
            onVersionRestored={handleVersionRestored}
          />
        )}
      </div>
    </div>
  );
}

