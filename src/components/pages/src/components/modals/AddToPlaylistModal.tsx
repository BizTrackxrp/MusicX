'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Check, Music, ListMusic, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';
import { Track } from '@/types';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  coverUrl: string | null;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: (Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) | null;
}

export default function AddToPlaylistModal({ isOpen, onClose, track }: AddToPlaylistModalProps) {
  const { theme } = useTheme();
  const { user } = useXaman();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());

  // Load user's playlists
  useEffect(() => {
    async function loadPlaylists() {
      if (!user?.address || !isOpen) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/playlists?user=${user.address}`);
        const data = await res.json();
        if (data.success && data.playlists) {
          setPlaylists(data.playlists);
        }
      } catch (error) {
        console.error('Failed to load playlists:', error);
      }
      setLoading(false);
    }
    
    loadPlaylists();
  }, [user?.address, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowCreateNew(false);
      setNewPlaylistName('');
      setAddedTo(new Set());
    }
  }, [isOpen]);

  const handleCreatePlaylist = async () => {
    if (!user?.address || !newPlaylistName.trim()) return;
    
    setCreating(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newPlaylistName.trim(),
          ownerAddress: user.address,
        }),
      });
      
      const data = await res.json();
      if (data.success && data.playlistId) {
        // Add track to the new playlist
        await handleAddToPlaylist(data.playlistId);
        
        // Reload playlists
        const reloadRes = await fetch(`/api/playlists?user=${user.address}`);
        const reloadData = await reloadRes.json();
        if (reloadData.success) {
          setPlaylists(reloadData.playlists);
        }
        
        setNewPlaylistName('');
        setShowCreateNew(false);
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
    setCreating(false);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!user?.address || !track) return;
    
    const trackId = track.trackId || track.id?.toString();
    const releaseId = track.releaseId;
    
    if (!trackId || !releaseId) {
      console.error('Missing track or release ID');
      return;
    }
    
    setAddingTo(playlistId);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addTrack',
          playlistId,
          ownerAddress: user.address,
          trackId,
          releaseId,
        }),
      });
      
      if (res.ok) {
        setAddedTo(prev => new Set([...prev, playlistId]));
        
        // Update local playlist count
        setPlaylists(prev => prev.map(p => 
          p.id === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p
        ));
      }
    } catch (error) {
      console.error('Failed to add to playlist:', error);
    }
    setAddingTo(null);
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark'
          ? 'bg-zinc-900 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Add to Playlist
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-300">
            <X size={20} />
          </button>
        </div>

        {/* Track being added */}
        <div className={`p-4 border-b flex items-center gap-3 ${theme === 'dark' ? 'border-zinc-800 bg-zinc-800/50' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            {track.cover ? (
              <img src={track.cover} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Music size={20} className="text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              {track.title}
            </p>
            <p className="text-zinc-500 text-sm truncate">{track.artist}</p>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Create New Playlist */}
              {showCreateNew ? (
                <div className={`p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Playlist name"
                    autoFocus
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPlaylistName.trim()) {
                        handleCreatePlaylist();
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowCreateNew(false)}
                      className={`flex-1 py-2 rounded-lg font-medium ${
                        theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-black'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim() || creating}
                      className="flex-1 py-2 rounded-lg font-medium bg-blue-500 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateNew(true)}
                  className={`w-full p-4 flex items-center gap-3 border-b transition-colors ${
                    theme === 'dark' 
                      ? 'border-zinc-800 hover:bg-zinc-800/50' 
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'
                  }`}>
                    <Plus size={24} className="text-blue-500" />
                  </div>
                  <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    Create New Playlist
                  </span>
                </button>
              )}

              {/* Existing Playlists */}
              {playlists.length === 0 && !showCreateNew ? (
                <div className="py-12 text-center">
                  <ListMusic size={48} className="mx-auto text-zinc-500 mb-3" />
                  <p className="text-zinc-500">No playlists yet</p>
                  <p className="text-zinc-600 text-sm">Create one to get started!</p>
                </div>
              ) : (
                playlists.map((playlist) => {
                  const isAdded = addedTo.has(playlist.id);
                  const isAdding = addingTo === playlist.id;
                  
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => !isAdded && handleAddToPlaylist(playlist.id)}
                      disabled={isAdded || isAdding}
                      className={`w-full p-4 flex items-center gap-3 border-b transition-colors ${
                        theme === 'dark' 
                          ? 'border-zinc-800 hover:bg-zinc-800/50 disabled:hover:bg-transparent' 
                          : 'border-zinc-200 hover:bg-zinc-50 disabled:hover:bg-transparent'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        {playlist.coverUrl ? (
                          <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'
                          }`}>
                            <ListMusic size={20} className="text-zinc-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                          {playlist.name}
                        </p>
                        <p className="text-zinc-500 text-sm">{playlist.trackCount} tracks</p>
                      </div>
                      {isAdding ? (
                        <Loader2 size={20} className="text-blue-500 animate-spin" />
                      ) : isAdded ? (
                        <Check size={20} className="text-green-500" />
                      ) : (
                        <Plus size={20} className="text-zinc-500" />
                      )}
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
