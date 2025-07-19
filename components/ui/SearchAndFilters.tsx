'use client';

import { Button } from './button';

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: 'all' | 'image' | 'text';
  onTypeFilterChange: (type: 'all' | 'image' | 'text') => void;
  hashtagFilter: string[];
  onHashtagFilterChange: (hashtags: string[]) => void;
  onClearFilters: () => void;
}

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  hashtagFilter,
  onHashtagFilterChange,
  onClearFilters,
}: SearchAndFiltersProps) {
  const handleHashtagInputChange = (value: string) => {
    onHashtagFilterChange(
      value.split(',').map((tag) => tag.trim()).filter(Boolean)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search cards..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="px-4 py-2 border rounded-lg"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as 'all' | 'image' | 'text')}
        >
          <option value="all">All Types</option>
          <option value="image">Image Cards</option>
          <option value="text">Text Cards</option>
        </select>
      </div>
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Filter by hashtags (comma-separated)"
          className="flex-1 px-4 py-2 border rounded-lg"
          value={hashtagFilter.join(', ')}
          onChange={(e) => handleHashtagInputChange(e.target.value)}
        />
        <Button variant="outline" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
