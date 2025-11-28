import { useState, useRef } from 'react';
import api from '../services/api';

interface FileUploadProps {
  onUploadSuccess: () => void;
  folderId?: number | null;
}

export default function FileUpload({ onUploadSuccess, folderId }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = [
    'video/*',
    'audio/*',
    'image/*',
  ];

  const validateFiles = (files: FileList): boolean => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isAudio && !isImage) {
        setError(`File "${file.name}" is not a video, audio, or image file`);
        return false;
      }
    }
    return true;
  };

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    if (!validateFiles(files)) {
      return;
    }

    setError('');
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      if (folderId !== null && folderId !== undefined) {
        formData.append('folderId', folderId.toString());
      }

      await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
        onUploadSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p>Uploading... {uploadProgress}%</p>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📤</div>
            <p>Drag and drop files here or click to browse</p>
            <p className="upload-hint">Supports video, audio, and image files</p>
          </div>
        )}
      </div>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}

