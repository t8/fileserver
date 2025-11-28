import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    // Real-time search as user types (debounced would be better for production)
    if (value.trim() === '') {
      onSearch('');
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search files by name..."
          value={query}
          onChange={handleChange}
          className="search-input"
        />
        {query && (
          <button type="button" onClick={handleClear} className="clear-button">
            ✕
          </button>
        )}
      </div>
      <button type="submit" className="search-button">
        Search
      </button>
    </form>
  );
}

