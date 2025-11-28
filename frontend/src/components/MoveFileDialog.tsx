import { useState, useEffect } from 'react';
import api from '../services/api';

interface Folder {
  id: number;
  name: string;
}

interface MoveFileDialogProps {
  fileId: number;
  fileName: string;
  currentFolderId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveFileDialog({ fileId, fileName, currentFolderId, onClose, onSuccess }: MoveFileDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(currentFolderId);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await api.get('/folders/contents');
      setFolders(response.data.folders || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    setMoving(true);
    setError('');

    try {
      await api.patch(`/files/move/${fileId}`, {
        folderId: selectedFolderId,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to move file');
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Move File</h2>
        <p>Move "{fileName}" to:</p>
        {loading ? (
          <div>Loading folders...</div>
        ) : (
          <div className="folder-selector">
            <label>
              <input
                type="radio"
                checked={selectedFolderId === null}
                onChange={() => setSelectedFolderId(null)}
              />
              Root (Home)
            </label>
            {folders.map((folder) => (
              <label key={folder.id}>
                <input
                  type="radio"
                  checked={selectedFolderId === folder.id}
                  onChange={() => setSelectedFolderId(folder.id)}
                />
                📁 {folder.name}
              </label>
            ))}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
        <div className="modal-actions">
          <button onClick={handleMove} disabled={moving} className="submit-button">
            {moving ? 'Moving...' : 'Move'}
          </button>
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

