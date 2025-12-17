'use client';

import { useState, useEffect } from 'react';
import { Home, ShoppingBag, User, Plus, Wallet, Music, Moon, Sun, X, Heart, ListMusic, Globe, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  coverUrl: string | null;
  isPublic: boolean;
}

interface SidebarProps {
  currentPage: 'stream' | 'marketplace' | 'profile' | 'playlist' | 'liked' | 'playlists-browse';
  setCurrentPage: (page: 'stream' | 'marketplace' | 'profile' | 'playlist' | 'liked' | 'playlists-browse') => void;
  user: { email?: string; wallet?: { address: string } } | null;
  onAuthClick: () => void;
  onCreateClick: () => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylist?: (playlistId: string) => void;
  selectedPlaylistId?: string | null;
  likedCount?: number;
}

export default function Sidebar({
  currentPage,
  setCurrentPage,
  user,
  onAuthClick,
  onCreateClick,
  onLogout,
  isOpen,
  onClose,
  onSelectPlaylist,
  selectedPlaylistId,
  likedCount = 0
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { disconnect } = useXaman();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showLibrary, setShowLibrary] = useState(true);
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showPlaylistMenu, setShowPlaylistMenu] = useState<string | null>(null);
  
  // Load profile from API (with localStorage fallback)
  useEffect(() => {
    async function loadProfile() {
      if (user?.wallet?.address) {
        try {
          const res = await fetch(`/api/profile?address=${user.wallet.address}`);
          const data = await res.json();
          if (data.success && data.profile) {
            setProfileName(data.profile.name || null);
            setProfileAvatar(data.profile.avatarUrl || null);
            return;
          }
        } catch (error) {
          console.error('Failed to load profile from API:', error);
        }
        
        // Fallback to localStorage
        const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setProfileName(parsed.name || null);
          setProfileAvatar(parsed.avatarUrl || null);
        }
      } else {
        setProfileName(null);
        setProfileAvatar(null);
      }
    }
    loadProfile();
  }, [user?.wallet?.address]);

  // Load user's playlists
  useEffect(() => {
    async function loadPlaylists() {
      if (!user?.wallet?.address) {
        setPlaylists([]);
        return;
      }
      
      try {
        const res = await fetch(`/api/playlists?user=${user.wallet.address}`);
        const data = await res.json();
        if (data.success && data.playlists) {
          setPlaylists(data.playlists);
        }
      } catch (error) {
        console.error('Failed to load playlists:', error);
      }
    }
    
    loadPlaylists();
    
    // Listen for playlist updates
    const handlePlaylistUpdate = () => loadPlaylists();
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [user?.wallet?.address]);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = async () => {
      if (user?.wallet?.address) {
        try {
          const res = await fetch(`/api/profile?address=${user.wallet.address}`);
          const data = await res.json();
          if (data.success && data.profile) {
            setProfileName(data.profile.name || null);
            setProfileAvatar(data.profile.avatarUrl || null);
            return;
          }
        } catch (error) {
          console.error('Failed to reload profile:', error);
        }
        
        // Fallback to localStorage
        const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setProfileName(parsed.name || null);
          setProfileAvatar(parsed.avatarUrl || null);
        }
      }
    };

    window.addEventListener('storage', handleProfileUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('storage', handleProfileUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user?.wallet?.address]);
  
  const navItems = [
    { id: 'stream' as const, label: 'Stream', icon: Home },
    { id: 'marketplace' as const, label: 'Marketplace', icon: ShoppingBag },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  const handleNavClick = (page: 'stream' | 'marketplace' | 'profile' | 'playlist' | 'liked' | 'playlists-browse') => {
    setCurrentPage(page);
    onClose();
  };

  const handlePlaylistClick = (playlistId: string) => {
    if (onSelectPlaylist) {
      onSelectPlaylist(playlistId);
    }
    setCurrentPage('playlist');
    onClose();
  };

  const handleLogout = () => {
    disconnect();
    onLogout();
    setProfileName(null);
    setProfileAvatar(null);
    setPlaylists([]);
  };

  const handleCreatePlaylist = async () => {
    if (!user?.wallet?.address) return;
    
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: `My Playlist #${playlists.length + 1}`,
          ownerAddress: user.wallet.address,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Reload playlists
        const reloadRes = await fetch(`/api/playlists?user=${user.wallet.address}`);
        const reloadData = await reloadRes.json();
        if (reloadData.success) {
          setPlaylists(reloadData.playlists);
        }
        
        // Select the new playlist
        if (data.playlistId && onSelectPlaylist) {
          onSelectPlaylist(data.playlistId);
          setCurrentPage('playlist');
        }
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const handleRenamePlaylist = async (playlistId: string) => {
    if (!user?.wallet?.address || !editName.trim()) return;
    
    try {
      await fetch('/api/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId,
          ownerAddress: user.wallet.address,
          name: editName.trim(),
        }),
      });
      
      // Reload playlists
      const res = await fetch(`/api/playlists?user=${user.wallet.address}`);
      const data = await res.json();
      if (data.success) {
        setPlaylists(data.playlists);
      }
    } catch (error) {
      console.error('Failed to rename playlist:', error);
    }
    
    setEditingPlaylist(null);
    setEditName('');
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!user?.wallet?.address) return;
    
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    
    try {
      await fetch(`/api/playlists?id=${playlistId}&owner=${user.wallet.address}`, {
        method: 'DELETE',
      });
      
      // Reload playlists
      const res = await fetch(`/api/playlists?user=${user.wallet.address}`);
      const data = await res.json();
      if (data.success) {
        setPlaylists(data.playlists);
      }
      
      // If we deleted the currently selected playlist, go back to stream
      if (selectedPlaylistId === playlistId) {
        setCurrentPage('stream');
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
    
    setShowPlaylistMenu(null);
  };

  const getDisplayName = () => {
    if (profileName) return profileName;
    if (user?.wallet?.address) return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`;
    return 'Connected';
  };

  const getInitial = () => {
    if (profileName) return profileName[0].toUpperCase();
    if (user?.wallet?.address) return user.wallet.address[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return 'U';
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed left-0 top-0 h-full w-64 backdrop-blur-xl border-r z-50 flex flex-col transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-zinc-950/95 border-zinc-800' 
          : 'bg-white/95 border-zinc-200'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        
        {/* Mobile close button */}
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg lg:hidden ${
            theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
          }`}
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <span className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              XRP Music
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
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

          {/* Create Button */}
          {user && (
            <div className="mt-6">
              <button
                onClick={() => { onCreateClick(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02]"
              >
                <Plus size={20} />
                Create & Mint
              </button>
            </div>
          )}

          {/* Your Library Section */}
          {user && (
            <div className="mt-6">
              <button
                onClick={() => setShowLibrary(!showLibrary)}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm font-semibold uppercase tracking-wider ${
                  theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                <span>Your Library</span>
                {showLibrary ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {showLibrary && (
                <div className="mt-2 space-y-1">
                  {/* Liked Songs */}
                  <button
                    onClick={() => handleNavClick('liked')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                      currentPage === 'liked'
                        ? 'bg-blue-500/10 text-blue-500'
                        : theme === 'dark'
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                          : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Heart size={14} className="text-white" fill="white" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">Liked Songs</p>
                      {likedCount > 0 && (
                        <p className="text-xs text-zinc-500">{likedCount} songs</p>
                      )}
                    </div>
                  </button>

                  {/* Browse Public Playlists */}
                  <button
                    onClick={() => handleNavClick('playlists-browse')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                      currentPage === 'playlists-browse'
                        ? 'bg-blue-500/10 text-blue-500'
                        : theme === 'dark'
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                          : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}>
                      <Globe size={14} className="text-blue-500" />
                    </div>
                    <span className="font-medium">Browse Playlists</span>
                  </button>

                  {/* Create Playlist Button */}
                  <button
                    onClick={handleCreatePlaylist}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                      theme === 'dark'
                        ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}>
                      <Plus size={14} />
                    </div>
                    <span className="font-medium">Create Playlist</span>
                  </button>

                  {/* User's Playlists */}
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="relative group">
                      {editingPlaylist === playlist.id ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenamePlaylist(playlist.id);
                              if (e.key === 'Escape') {
                                setEditingPlaylist(null);
                                setEditName('');
                              }
                            }}
                            onBlur={() => handleRenamePlaylist(playlist.id)}
                            autoFocus
                            className={`flex-1 px-2 py-1 rounded text-sm border focus:outline-none focus:border-blue-500 ${
                              theme === 'dark'
                                ? 'bg-zinc-800 border-zinc-700 text-white'
                                : 'bg-zinc-100 border-zinc-300 text-black'
                            }`}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePlaylistClick(playlist.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                            currentPage === 'playlist' && selectedPlaylistId === playlist.id
                              ? 'bg-blue-500/10 text-blue-500'
                              : theme === 'dark'
                                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                            {playlist.coverUrl ? (
                              <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${
                                theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
                              }`}>
                                <ListMusic size={14} className="text-zinc-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium truncate">{playlist.name}</p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              {playlist.isPublic && <Globe size={10} />}
                              {playlist.trackCount} songs
                            </p>
                          </div>
                        </button>
                      )}
                      
                      {/* Playlist menu button */}
                      {editingPlaylist !== playlist.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPlaylistMenu(showPlaylistMenu === playlist.id ? null : playlist.id);
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                            theme === 'dark'
                              ? 'hover:bg-zinc-700 text-zinc-400'
                              : 'hover:bg-zinc-200 text-zinc-500'
                          }`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      )}

                      {/* Playlist dropdown menu */}
                      {showPlaylistMenu === playlist.id && (
                        <div className={`absolute right-2 top-full mt-1 z-10 rounded-xl border shadow-lg overflow-hidden ${
                          theme === 'dark'
                            ? 'bg-zinc-900 border-zinc-800'
                            : 'bg-white border-zinc-200'
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(playlist.name);
                              setEditingPlaylist(playlist.id);
                              setShowPlaylistMenu(null);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-zinc-800 text-zinc-300'
                                : 'hover:bg-zinc-50 text-zinc-700'
                            }`}
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
            <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                {profileAvatar ? (
                  <img 
                    src={profileAvatar} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold text-white">
                    {getInitial()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {user.wallet ? getDisplayName() : user.email || 'Connected'}
                  </p>
                  <p className="text-zinc-500 text-sm truncate">
                    {user.wallet ? user.wallet.address.slice(0, 8) + '...' + user.wallet.address.slice(-4) : 'Email login'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onAuthClick(); onClose(); }}
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
    </>
  );
}

