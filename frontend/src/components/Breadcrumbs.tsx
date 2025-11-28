import React from 'react';

interface Breadcrumb {
  id: number;
  name: string;
}

interface BreadcrumbsProps {
  path: Breadcrumb[];
  onNavigate: (folderId: number | null) => void;
}

export default function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  return (
    <div className="breadcrumbs">
      <button onClick={() => onNavigate(null)} className="breadcrumb-item">
        🏠 Home
      </button>
      {path.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <span className="breadcrumb-separator">
            ›
          </span>
          <button
            onClick={() => onNavigate(folder.id)}
            className="breadcrumb-item"
            disabled={index === path.length - 1}
          >
            {folder.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

