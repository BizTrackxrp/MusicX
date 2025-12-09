'use client';

import { Search, MessageCircle, Bell } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onMessengerClick: () => void;
  hasUnreadMessages?: boolean;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  onMessengerClick,
  hasUnreadMessages = true
}: HeaderProps) {
  const { theme } = useTheme();
  
  return (
    <header className={`sticky top-0 z-20 backdrop-blur-xl border-b transition-colors ${
      theme === 'dark' 
        ? 'bg-black/80 border-zinc-800/50' 
        : 'bg-white/80 border-zinc-200'
    }`}>
      <div className="flex items-center justify-between px-8 py-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, NFTs..."
            className={`w-full pl-12 pr-4 py-2.5 rounded-full transition-colors focus:outline-none focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500'
                : 'bg-zinc-100 border border-zinc-200 text-black placeholder-zinc-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onMessengerClick}
            className={`relative p-2.5 transition-colors ${
              theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <MessageCircle size={22} />
            {hasUnreadMessages && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          <button className={`p-2.5 transition-colors ${
            theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
          }`}>
            <Bell size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
