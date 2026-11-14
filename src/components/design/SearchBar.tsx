import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onClear?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  size?: 'md' | 'lg';
  className?: string;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onClear,
      onFocus,
      placeholder = 'Search songs, artists, albums, or paste Gaana link',
      size = 'lg',
      className = '',
    },
    ref
  ) => {
    const heightClass = size === 'lg' ? 'py-3.5 pl-12 pr-11 text-sm' : 'py-2.5 pl-10 pr-10 text-xs sm:text-sm';

    const content = (
      <div className={`relative w-full ${className}`}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`w-full bg-[#191919] hover:bg-[#222222] focus:bg-[#111111] border border-[#303030] focus:border-white/50 text-white rounded-xl ${heightClass} focus:outline-none transition-colors placeholder:text-[#737373] font-medium`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#A3A3A3] hover:text-white hover:bg-[#222222] transition cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );

    if (onSubmit) {
      return (
        <form onSubmit={onSubmit} className="w-full">
          {content}
        </form>
      );
    }

    return content;
  }
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
