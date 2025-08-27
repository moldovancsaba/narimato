'use client';

import React, { useState, useRef, useEffect } from 'react';

interface HashtagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function HashtagEditor({ 
  tags, 
  onChange, 
  placeholder = "Add hashtags...",
  className = ""
}: HashtagEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simulated hashtag suggestions - in a real app, this would come from an API
  const commonHashtags = [
    'funny', 'meme', 'educational', 'trivia', 'facts', 'animals', 
    'technology', 'science', 'history', 'sports', 'movies', 'music', 
    'art', 'nature', 'travel', 'food', 'gaming', 'quotes', 'tips',
    'diy', 'health', 'fitness', 'motivation', 'inspiration'
  ];

  useEffect(() => {
    if (inputValue.startsWith('#') && inputValue.length > 1) {
      const query = inputValue.slice(1).toLowerCase();
      const filtered = commonHashtags
        .filter(tag => 
          tag.toLowerCase().includes(query) && 
          !tags.some(existingTag => existingTag.toLowerCase() === tag.toLowerCase())
        )
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [inputValue, tags]);

  const addTag = (tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
    if (cleanTag && !tags.some(existingTag => existingTag.toLowerCase() === cleanTag.toLowerCase())) {
      onChange([...tags, cleanTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        addTag(suggestions[selectedSuggestionIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag if input is empty
      removeTag(tags.length - 1);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="form-input min-h-[42px] py-2 px-3 flex flex-wrap items-center gap-2 cursor-text"
           onClick={() => inputRef.current?.focus()}>
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-bold text-xs w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
        />
      </div>
      
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                index === selectedSuggestionIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-gray-400">#</span>
              {suggestion}
            </button>
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted mt-1">
        Type hashtags (with or without #) and press Enter to add. Use arrow keys to navigate suggestions.
      </p>
    </div>
  );
}
