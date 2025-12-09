'use client';

import { Home, ShoppingBag, User, Plus, LogOut, Wallet, Music } from 'lucide-react';

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
  const navItems = [
    { id: 'stream' as const, label: 'Stream', icon: Home },
    { id: 'marketplace' as const, label: 'Marketplace', icon: ShoppingBag },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-800 z-30 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <Music size={20} className="text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Music X</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentPage === item.id
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Create Button - only show when logged in */}
        {user && (
          <div className="mt-8">
            <button
              onClick={onCreateClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold rounded-xl transition-all transform hover:scale-[1.02]"
            >
              <Plus size={20} />
              Create & Mint
            </button>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-zinc-800">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-black">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user.email || 'Connected'}</p>
              <p className="text-zinc-500 text-sm truncate">
                {user.wallet ? user.wallet.address.slice(0, 8) + '...' : 'Email login'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Wallet size={18} />
            Connect / Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
