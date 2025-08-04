'use client';

import React, { useState, useCallback, useEffect } from 'react';

interface HashtagSelectorProps {
  // Data
  availableHashtags: string[]; // All possible hashtags to choose from
  selectedHashtags: string[]; // Currently selected hashtags
  onHashtagsChange: (hashtags: string[]) => void; // Callback when selection changes
  
  // UI Configuration
  placeholder?: string;
  label?: string;
  maxSuggestions?: number;
  allowCustomHashtags?: boolean; // Allow creating new hashtags
  
  // Filtering
  excludeSelected?: boolean; // Hide already selected hashtags from suggestions
  
  // Styling
  className?: string;
}

export default function HashtagSelector({
  availableHashtags,
  selectedHashtags,
  onHashtagsChange,
  placeholder = "Search for hashtags...",
  label = "Hashtags",
  maxSuggestions = 10,
  allowCustomHashtags = false,
  excludeSelected = true,
  className = ""
}: HashtagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get filtered suggestions based on input
  const getFilteredSuggestions = useCallback((query: string) => {
    if (!query.trim()) return [];
    
    let filtered = availableHashtags.filter(hashtag =>
      hashtag.toLowerCase().includes(query.toLowerCase())
    );
    
    // Exclude already selected hashtags if requested
    if (excludeSelected) {
      filtered = filtered.filter(hashtag => !selectedHashtags.includes(hashtag));
    }
    
    return filtered.slice(0, maxSuggestions);
  }, [availableHashtags, selectedHashtags, excludeSelected, maxSuggestions]);

  // Update suggestions when input changes
  useEffect(() => {
    const filtered = getFilteredSuggestions(inputValue);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [inputValue, getFilteredSuggestions]);

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Add hashtag to selection
  const addHashtag = (hashtag: string) => {
    if (!selectedHashtags.includes(hashtag)) {
      onHashtagsChange([...selectedHashtags, hashtag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  // Remove hashtag from selection
  const removeHashtag = (hashtag: string) => {
    onHashtagsChange(selectedHashtags.filter(h => h !== hashtag));
  };

  // Handle Enter key for custom hashtags
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && allowCustomHashtags && inputValue.trim()) {
      e.preventDefault();
      let hashtag = inputValue.trim();
      
      // Ensure hashtag starts with #
      if (!hashtag.startsWith('#')) {
        hashtag = `#${hashtag}`;
      }
      
      // Validate hashtag format
      if (/^#[A-Z0-9_-]+$/i.test(hashtag)) {
        addHashtag(hashtag);
      }
    }
  };

  // Handle clicking outside to close suggestions
  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={`hashtag-selector ${className}`}>
      {label && (
        <label className="form-label">{label}</label>
      )}
      
      {/* Input field */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          className="form-input"
          placeholder={placeholder}
        />
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="hashtag-suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => addHashtag(suggestion)}
                className="hashtag-suggestion"
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected hashtags */}
      {selectedHashtags.length > 0 && (
        <div className="hashtag-selected-container">
          {selectedHashtags.map((hashtag, index) => (
            <span
              key={index}
              className="hashtag-badge"
            >
              {hashtag}
              <button
                onClick={() => removeHashtag(hashtag)}
                className="hashtag-remove"
                type="button"
                aria-label={`Remove ${hashtag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Help text */}
      {allowCustomHashtags && (
        <p className="text-xs text-muted mt-1">
          Type and press Enter to create custom hashtags
        </p>
      )}
    </div>
  );
}
