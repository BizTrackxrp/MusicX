'use client';

import { Search, Bell, MessageCircle, Menu } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface HeaderProps {
  onMessagesClick: () => void;
  onMenuClick: () => void;
}

export default function Header({ onMessagesClick, onMenuClick }: HeaderProps) {
  const { theme } = useTheme();
  
  return (
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

        <div className="flex-1 max-w-xl hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search tracks, artists, albums..."
              className={`w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:border-blue-500 transition-colors ${
                theme === 'dark'
                  ? 'bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500'
                  : 'bg-zinc-100 border-zinc-200 text-black placeholder-zinc-400'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className={`p-2 rounded-xl transition-colors sm:hidden ${
            theme === 'dark' 
              ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}>
            <Search size={20} />
          </button>
          <button className={`p-2 rounded-xl transition-colors relative ${
            theme === 'dark' 
              ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}>
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </button>
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
  );
}
