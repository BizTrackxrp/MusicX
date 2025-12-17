'use client';

import { useState, useEffect } from 'react';
import { Heart, Music, ListMusic, TrendingUp, Clock, Users } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';

interface PublicPlaylist {
  id: string;
  name: string;
  description: string | null;
  ownerAddress: string;
  ownerName: string | null;
  ownerAvatar: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  likesCount: number;
  trackCount: number;
  createdAt: string;
}

interface PublicPlaylistsPageProps {
  onSelectPlaylist: (playlistId: string) => void;
}

export default function PublicPlaylistsPage({ onSelectPlaylist }: PublicPlaylistsPageProps) {
  const { theme } = useTheme();
  const { user } = useXaman();
  const [newestPlaylists, setNewestPlaylists] = useState<PublicPlaylist[]>([]);
  const [popularPlaylists, setPopularPlaylists] = useState<PublicPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPlaylistIds, setLikedPlaylistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const [newestRes, popularRes] = await Promise.all([
        fetch('/api/playlists?public=true&sort=newest'),
        fetch('/api/playlists?public=true&sort=popular'),
      ]);
      
      const newestData = await newestRes.json();
      const popularData = await popularRes.json();
      
      if (newestData.success) setNewestPlaylists(newestData.playlists);
      if (popularData.success) setPopularPlaylists(popularData.playlists);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
    setLoading(false);
  };

  const handleLikePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.address) return;
    
    const isLiked = likedPlaylistIds.has(playlistId);
    
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLiked ? 'unlike' : 'like',
          playlistId,
          userAddress: user.address,
        }),
      });
      
      // Update local state
      setLikedPlaylistIds(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.delete(playlistId);
        } else {
          newSet.add(playlistId);
        }
        return newSet;
      });
      
      // Update counts
      const updateCount = (playlists: PublicPlaylist[]) =>
        playlists.map(p =>
          p.id === playlistId
            ? { ...p, likesCount: p.likesCount + (isLiked ? -1 : 1) }
            : p
        );
      
      setNewestPlaylists(updateCount);
      setPopularPlaylists(updateCount);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const PlaylistCard = ({ playlist }: { playlist: PublicPlaylist }) => {
    const isLiked = likedPlaylistIds.has(playlist.id);
    
    return (
      <div
        onClick={() => onSelectPlaylist(playlist.id)}
        className={`group rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.02] ${
          theme === 'dark'
            ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            : 'bg-white border-zinc-200 hover:border-zinc-300'
        }`}
      >
        {/* Cover */}
        <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
            }`}>
              <ListMusic size={40} className="text-zinc-500" />
            </div>
          )}
          
          {/* Like button overlay */}
          {user?.address && (
            <button
              onClick={(e) => handleLikePlaylist(playlist.id, e)}
              className={`absolute top-2 right-2 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                isLiked
                  ? 'bg-pink-500 text-white'
                  : theme === 'dark'
                    ? 'bg-black/50 text-white hover:bg-black/70'
                    : 'bg-white/50 text-black hover:bg-white/70'
              }`}
            >
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        {/* Info */}
        <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {playlist.name}
        </h3>
        
        <div className="flex items-center gap-2 mt-1">
          {playlist.ownerAvatar ? (
            <img src={playlist.ownerAvatar} alt="" className="w-4 h-4 rounded-full" />
          ) : (
            <div className={`w-4 h-4 rounded-full ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
          )}
          <span className="text-zinc-500 text-sm truncate">
            {playlist.ownerName || `${playlist.ownerAddress.slice(0, 6)}...`}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Music size={12} />
            {playlist.trackCount}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={12} fill={playlist.likesCount > 0 ? 'currentColor' : 'none'} />
            {playlist.likesCount}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          Browse Playlists
        </h1>
        <p className="text-zinc-500 mt-1">Discover playlists from the community</p>
      </div>

      {/* Most Popular Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-blue-500" size={20} />
          <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Most Liked
          </h2>
        </div>
        
        {popularPlaylists.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <Users size={40} className="mx-auto text-zinc-500 mb-2" />
            <p className="text-zinc-500">No public playlists yet</p>
            <p className="text-zinc-600 text-sm mt-1">Be the first to share a playlist!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {popularPlaylists.slice(0, 10).map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}
      </section>

      {/* Newest Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-green-500" size={20} />
          <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Recently Created
          </h2>
        </div>
        
        {newestPlaylists.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <Clock size={40} className="mx-auto text-zinc-500 mb-2" />
            <p className="text-zinc-500">No playlists yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {newestPlaylists.slice(0, 10).map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
