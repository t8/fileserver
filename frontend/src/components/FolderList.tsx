import { Folder, File } from '../pages/Dashboard';
import api from '../services/api';

interface FolderListProps {
  folders: Folder[];
  files: File[];
  loading: boolean;
  onFolderClick: (folderId: number) => void;
  onRefresh: () => void;
  onMoveFile?: (fileId: number) => void;
  onShowVersions?: (fileId: number) => void;
}

export default function FolderList({
  folders,
  files,
  loading,
  onFolderClick,
  onRefresh,
  onMoveFile,
  onShowVersions,
}: FolderListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.startsWith('image/')) return '🖼️';
    return '📄';
  };

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      const response = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  if (loading) {
    return (
      <div className="file-list-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="file-list-container">
        <div className="empty-state">
          <p>No folders or files</p>
          <button onClick={onRefresh} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <h2>
          {folders.length > 0 && `${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
          {folders.length > 0 && files.length > 0 && ', '}
          {files.length > 0 && `${files.length} file${files.length !== 1 ? 's' : ''}`}
        </h2>
        <button onClick={onRefresh} className="refresh-button">
          Refresh
        </button>
      </div>
      <div className="file-grid">
        {folders.map((folder) => (
          <div key={folder.id} className="file-card folder-card" onClick={() => onFolderClick(folder.id)}>
            <div className="file-icon">📁</div>
            <div className="file-info">
              <div className="file-name" title={folder.name}>
                {folder.name}
              </div>
              <div className="file-meta">
                <span>Folder</span>
                <span>•</span>
                <span>{formatDate(folder.createdAt)}</span>
              </div>
              <div className="file-uploader">Created by {folder.createdBy}</div>
            </div>
            <div className="folder-click-hint">Click to open</div>
          </div>
        ))}
        {files.map((file) => (
          <div key={file.id} className="file-card">
            <div className="file-icon">{getFileIcon(file.mimeType)}</div>
            <div className="file-info">
              <div className="file-name" title={file.filename}>
                {file.filename}
                {file.currentVersion && file.currentVersion > 1 && (
                  <span className="version-badge">v{file.currentVersion}</span>
                )}
              </div>
              <div className="file-meta">
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{formatDate(file.uploadedAt)}</span>
              </div>
              <div className="file-uploader">Uploaded by {file.uploadedBy}</div>
            </div>
            <div className="file-actions">
              <button
                onClick={() => handleDownload(file.id, file.filename)}
                className="download-button"
                title="Download"
              >
                ⬇️ Download
              </button>
              {onMoveFile && (
                <button onClick={() => onMoveFile(file.id)} className="move-button" title="Move">
                  📦 Move
                </button>
              )}
              {onShowVersions && (
                <button onClick={() => onShowVersions(file.id)} className="versions-button" title="Versions">
                  📚 Versions
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

