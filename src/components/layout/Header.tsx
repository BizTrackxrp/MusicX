'use client';

import { Search, MessageCircle, Bell } from 'lucide-react';

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
  return (
    <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, NFTs..."
            className="w-full pl-12 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMessengerClick}
            className="relative p-2.5 text-zinc-400 hover:text-white transition-colors"
          >
            <MessageCircle size={22} />
            {hasUnreadMessages && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>
          <button className="p-2.5 text-zinc-400 hover:text-white transition-colors">
            <Bell size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
