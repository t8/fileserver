import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface Version {
  id: number;
  versionNumber: number;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  isCurrent: boolean;
}

interface VersionHistoryProps {
  fileId: number;
  fileName: string;
  onClose: () => void;
  onVersionRestored: () => void;
}

export default function VersionHistory({ fileId, fileName, onClose, onVersionRestored }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVersions();
  }, [fileId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/versions/${fileId}`);
      setVersions(response.data.versions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    try {
      await api.post(`/versions/restore/${fileId}/${versionNumber}`);
      onVersionRestored();
      loadVersions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restore version');
    }
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    try {
      const response = await api.get(`/versions/download/${fileId}/${versionNumber}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}_v${versionNumber}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download version');
    }
  };

  const handleUploadVersion = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVersion(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(`/versions/upload/${fileId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      loadVersions();
      onVersionRestored();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload version');
    } finally {
      setUploadingVersion(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-header-section">
          <h2>Version History: {fileName}</h2>
          <button onClick={handleUploadVersion} disabled={uploadingVersion} className="upload-version-button">
            {uploadingVersion ? 'Uploading...' : '📤 Upload New Version'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            accept="video/*,audio/*,image/*"
            onChange={handleFileChange}
          />
        </div>
        {loading ? (
          <div>Loading versions...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : versions.length === 0 ? (
          <div>No versions found</div>
        ) : (
          <div className="version-list">
            {versions.map((version) => (
              <div key={version.id} className={`version-item ${version.isCurrent ? 'current' : ''}`}>
                <div className="version-info">
                  <div className="version-header">
                    <span className="version-number">Version {version.versionNumber}</span>
                    {version.isCurrent && <span className="current-badge">Current</span>}
                  </div>
                  <div className="version-details">
                    <span>{formatFileSize(version.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(version.uploadedAt)}</span>
                    <span>•</span>
                    <span>by {version.uploadedBy}</span>
                  </div>
                </div>
                <div className="version-actions">
                  <button
                    onClick={() => handleDownloadVersion(version.versionNumber)}
                    className="download-version-button"
                  >
                    ⬇️ Download
                  </button>
                  {!version.isCurrent && (
                    <button
                      onClick={() => handleRestore(version.versionNumber)}
                      className="restore-version-button"
                    >
                      ↻ Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

