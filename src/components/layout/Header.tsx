'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Bell, MessageCircle, Menu, Wallet, X, Music, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface Release {
  id: string;
  type: string;
  title: string;
  artistName: string;
  artistAddress: string;
  coverUrl: string;
  songPrice: number;
}

interface HeaderProps {
  onMessagesClick: () => void;
  onMenuClick: () => void;
  onAuthClick?: () => void;
  isLoggedIn?: boolean;
  onSelectRelease?: (release: Release) => void;
}

export default function Header({ onMessagesClick, onMenuClick, onAuthClick, isLoggedIn, onSelectRelease }: HeaderProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Release[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success && data.releases) {
          setSearchResults(data.releases);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (release: Release) => {
    setShowResults(false);
    setSearchQuery('');
    setShowMobileSearch(false);
    if (onSelectRelease) {
      onSelectRelease(release);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already handled by the effect
  };

  const SearchInput = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div ref={isMobile ? undefined : searchRef} className="relative w-full">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Search tracks, artists, albums..."
            autoFocus={isMobile}
            className={`w-full pl-10 pr-10 py-2 rounded-xl border focus:outline-none focus:border-blue-500 transition-colors ${
              theme === 'dark'
                ? 'bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500'
                : 'bg-zinc-100 border-zinc-200 text-black placeholder-zinc-400'
            }`}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 animate-spin" size={18} />
          )}
          {!isSearching && searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-zinc-200'
        }`}>
          {searchResults.map((release) => (
            <button
              key={release.id}
              onClick={() => handleSelectResult(release)}
              className={`w-full flex items-center gap-3 p-3 transition-colors text-left ${
                theme === 'dark'
                  ? 'hover:bg-zinc-800'
                  : 'hover:bg-zinc-50'
              }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                {release.coverUrl ? (
                  <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Music size={20} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {release.title}
                </p>
                <p className="text-zinc-500 text-sm truncate">
                  {release.artistName || `${release.artistAddress.slice(0, 6)}...`} • {release.type}
                </p>
              </div>
              <span className="text-blue-500 font-medium text-sm flex-shrink-0">
                {release.songPrice} XRP
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl p-6 text-center z-50 ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-white border-zinc-200'
        }`}>
          <Music size={32} className="mx-auto text-zinc-500 mb-2" />
          <p className="text-zinc-500">No results found for "{searchQuery}"</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className={`h-16 border-b backdrop-blur-xl sticky top-0 z-30 transition-colors ${
        theme === 'dark' 
          ? 'bg-black/80 border-zinc-800' 
          : 'bg-white/80 border-zinc-200'
      }`}>
        <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button 
            onClick={onMenuClick}
            className={`p-2 rounded-lg lg:hidden ${
              theme === 'dark' 
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
            }`}
          >
            <Menu size={24} />
          </button>

          {/* Search - hidden on small screens */}
          <div className="flex-1 max-w-xl hidden sm:block" ref={searchRef}>
            <SearchInput />
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile search button */}
            <button 
              onClick={() => setShowMobileSearch(true)}
              className={`p-2 rounded-xl transition-colors sm:hidden ${
                theme === 'dark' 
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              <Search size={20} />
            </button>

            {/* Connect Wallet button - shown on mobile when not logged in */}
            {!isLoggedIn && onAuthClick && (
              <button
                onClick={onAuthClick}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-medium rounded-xl transition-all text-sm"
              >
                <Wallet size={16} />
                <span className="hidden xs:inline">Connect</span>
              </button>
            )}

            {/* Notifications */}
            <button className={`p-2 rounded-xl transition-colors relative ${
              theme === 'dark' 
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
            }`}>
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
            </button>

            {/* Messages */}
            <button
              onClick={onMessagesClick}
              className={`p-2 rounded-xl transition-colors ${
                theme === 'dark' 
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              <MessageCircle size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className={`fixed inset-0 z-50 sm:hidden ${
          theme === 'dark' ? 'bg-zinc-950' : 'bg-white'
        }`}>
          <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className={`p-2 rounded-lg ${
                theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
              }`}
            >
              <X size={24} />
            </button>
            <div className="flex-1">
              <SearchInput isMobile />
            </div>
          </div>

          {/* Mobile Search Results */}
          <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
            {searchResults.map((release) => (
              <button
                key={release.id}
                onClick={() => handleSelectResult(release)}
                className={`w-full flex items-center gap-3 p-4 transition-colors text-left border-b ${
                  theme === 'dark'
                    ? 'hover:bg-zinc-900 border-zinc-800'
                    : 'hover:bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  {release.coverUrl ? (
                    <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Music size={24} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {release.title}
                  </p>
                  <p className="text-zinc-500 text-sm truncate">
                    {release.artistName || `${release.artistAddress.slice(0, 6)}...`} • {release.type}
                  </p>
                </div>
                <span className="text-blue-500 font-medium">
                  {release.songPrice} XRP
                </span>
              </button>
            ))}

            {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
              <div className="p-12 text-center">
                <Music size={48} className="mx-auto text-zinc-500 mb-3" />
                <p className="text-zinc-500">No results found for "{searchQuery}"</p>
              </div>
            )}

            {searchQuery.length < 2 && (
              <div className="p-12 text-center">
                <Search size={48} className="mx-auto text-zinc-500 mb-3" />
                <p className="text-zinc-500">Search for tracks, artists, or albums</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

