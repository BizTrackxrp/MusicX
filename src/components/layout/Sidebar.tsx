'use client';

import { Home, ShoppingBag, User, Plus, LogOut, Wallet, Music, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface SidebarProps {
  currentPage: 'stream' | 'marketplace' | 'profile';
  setCurrentPage: (page: 'stream' | 'marketplace' | 'profile') => void;
  user: { email?: string; wallet?: { address: string } } | null;
  onAuthClick: () => void;
  onCreateClick: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  currentPage,
  setCurrentPage,
  user,
  onAuthClick,
  onCreateClick,
  onLogout
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  
  const navItems = [
    { id: 'stream' as const, label: 'Stream', icon: Home },
    { id: 'marketplace' as const, label: 'Marketplace', icon: ShoppingBag },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 backdrop-blur-xl border-r z-30 flex flex-col transition-colors ${
      theme === 'dark' 
        ? 'bg-zinc-950/80 border-zinc-800' 
        : 'bg-white/80 border-zinc-200'
    }`}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <Music size={20} className="text-white" />
          </div>
          <span className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Music X
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentPage === item.id
                  ? 'bg-blue-500/10 text-blue-500'
                  : theme === 'dark'
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {user && (
          <div className="mt-8">
            <button
              onClick={onCreateClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02]"
            >
              <Plus size={20} />
              Create & Mint
            </button>
          </div>
        )}
      </nav>

      <div className={`p-4 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3 transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="font-medium">Dark Mode</span>
          </div>
          <div className={`w-10 h-6 rounded-full p-1 transition-colors ${
            theme === 'dark' ? 'bg-blue-500' : 'bg-zinc-300'
          }`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
              theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold text-white">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {user.email || 'Connected'}
              </p>
              <p className="text-zinc-500 text-sm truncate">
                {user.wallet ? user.wallet.address.slice(0, 8) + '...' : 'Email login'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
              theme === 'dark'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                : 'bg-zinc-200 hover:bg-zinc-300 text-black'
            }`}
          >
            <Wallet size={18} />
            Connect / Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
