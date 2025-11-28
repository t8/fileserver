import { useState } from 'react';
import api from '../services/api';

interface CreateFolderProps {
  parentFolderId: number | null;
  onSuccess: () => void;
}

export default function CreateFolder({ parentFolderId, onSuccess }: CreateFolderProps) {
  const [showForm, setShowForm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/folders/create', {
        name: folderName.trim(),
        parentFolderId,
      });
      setFolderName('');
      setShowForm(false);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="create-folder-button">
        📁 New Folder
      </button>
    );
  }

  return (
    <form className="create-folder-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Folder name"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        autoFocus
        className="folder-name-input"
      />
      <div className="folder-form-actions">
        <button type="submit" disabled={loading} className="submit-folder-button">
          {loading ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={() => { setShowForm(false); setFolderName(''); setError(''); }} className="cancel-button">
          Cancel
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
    </form>
  );
}

