import { useState, useEffect } from 'react';
import api from '../services/api';

interface StorageIndicatorProps {
  refreshTrigger?: number;
}

export default function StorageIndicator({ refreshTrigger }: StorageIndicatorProps) {
  const [totalStorage, setTotalStorage] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageStats();
  }, [refreshTrigger]);

  const loadStorageStats = async () => {
    try {
      const response = await api.get('/files/stats');
      setTotalStorage(response.data.totalStorage || 0);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return null;
  }

  return (
    <div className="storage-indicator">
      <span className="storage-icon">💾</span>
      <span className="storage-text">Total Storage: {formatFileSize(totalStorage)}</span>
    </div>
  );
}

