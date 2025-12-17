'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Shuffle, MoreHorizontal, Pencil, Trash2, Globe, Lock, GripVertical, X, Music, Clock, Heart } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';
import { Track } from '@/types';

interface PlaylistTrack {
  id: string;
  trackId: string;
  releaseId: string;
  position: number;
  title: string;
  releaseTitle: string;
  artistName: string;
  artistAddress: string;
  coverUrl: string;
  audioUrl: string;
  audioCid: string;
  duration: number;
  songPrice: number;
  totalEditions: number;
  soldEditions: number;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  ownerAddress: string;
  coverUrl: string | null;
  isPublic: boolean;
  likesCount: number;
  trackCount: number;
  createdAt: string;
  tracks: PlaylistTrack[];
}

interface PlaylistPageProps {
  playlistId: string;
  onPlayTrack: (track: Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) => void;
  onPlayAll: (tracks: (Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string })[], shuffle?: boolean) => void;
  currentlyPlayingId?: string | null;
  isPlaying?: boolean;
}

export default function PlaylistPage({ playlistId, onPlayTrack, onPlayAll, currentlyPlayingId, isPlaying }: PlaylistPageProps) {
  const { theme } = useTheme();
  const { user } = useXaman();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const isOwner = user?.address === playlist?.ownerAddress;

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  const loadPlaylist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists?id=${playlistId}&withTracks=true`);
      const data = await res.json();
      if (data.success && data.playlist) {
        setPlaylist(data.playlist);
        setEditName(data.playlist.name);
        setEditDescription(data.playlist.description || '');
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
    setLoading(false);
  };

  const handlePlayAll = (shuffle = false) => {
    if (!playlist?.tracks.length) return;
    
    const tracks = playlist.tracks.map(t => ({
      id: parseInt(t.trackId) || 0,
      title: t.title,
      duration: t.duration?.toString() || '0:00',
      price: t.songPrice,
      available: t.totalEditions - t.soldEditions,
      plays: 0,
      mediaType: 'audio' as const,
      ipfsHash: t.audioCid,
      artist: t.artistName || t.artistAddress.slice(0, 8) + '...',
      cover: t.coverUrl,
      releaseId: t.releaseId,
      trackId: t.trackId,
    }));
    
    onPlayAll(tracks, shuffle);
  };

  const handlePlayTrack = (track: PlaylistTrack) => {
    onPlayTrack({
      id: parseInt(track.trackId) || 0,
      title: track.title,
      duration: track.duration?.toString() || '0:00',
      price: track.songPrice,
      available: track.totalEditions - track.soldEditions,
      plays: 0,
      mediaType: 'audio',
      ipfsHash: track.audioCid,
      artist: track.artistName || track.artistAddress.slice(0, 8) + '...',
      cover: track.coverUrl,
      releaseId: track.releaseId,
      trackId: track.trackId,
    });
  };

  const handleSaveEdit = async () => {
    if (!user?.address || !playlist) return;
    
    try {
      await fetch('/api/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId: playlist.id,
          ownerAddress: user.address,
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      
      setPlaylist(prev => prev ? { ...prev, name: editName.trim(), description: editDescription.trim() || null } : null);
      setIsEditing(false);
      window.dispatchEvent(new Event('playlistUpdated'));
    } catch (error) {
      console.error('Failed to update playlist:', error);
    }
  };

  const handleTogglePublic = async () => {
    if (!user?.address || !playlist) return;
    
    try {
      await fetch('/api/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId: playlist.id,
          ownerAddress: user.address,
          isPublic: !playlist.isPublic,
        }),
      });
      
      setPlaylist(prev => prev ? { ...prev, isPublic: !prev.isPublic } : null);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to toggle public:', error);
    }
  };

  const handleRemoveTrack = async (playlistTrackId: string) => {
    if (!user?.address || !playlist) return;
    
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeTrack',
          playlistId: playlist.id,
          ownerAddress: user.address,
          playlistTrackId,
        }),
      });
      
      setPlaylist(prev => prev ? {
        ...prev,
        tracks: prev.tracks.filter(t => t.id !== playlistTrackId),
        trackCount: prev.trackCount - 1,
      } : null);
    } catch (error) {
      console.error('Failed to remove track:', error);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !playlist) return;
    
    const newTracks = [...playlist.tracks];
    const draggedTrack = newTracks[draggedIndex];
    newTracks.splice(draggedIndex, 1);
    newTracks.splice(index, 0, draggedTrack);
    
    setPlaylist(prev => prev ? { ...prev, tracks: newTracks } : null);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (!user?.address || !playlist || draggedIndex === null) return;
    
    // Save new order to backend
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          playlistId: playlist.id,
          ownerAddress: user.address,
          trackIds: playlist.tracks.map(t => t.id),
        }),
      });
    } catch (error) {
      console.error('Failed to reorder tracks:', error);
    }
    
    setDraggedIndex(null);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!playlist?.tracks.length) return '0 min';
    const total = playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} hr ${mins} min`;
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center py-12">
        <Music size={48} className="mx-auto text-zinc-500 mb-3" />
        <p className="text-zinc-500">Playlist not found</p>
      </div>
    );
  }

  // Get cover image from first track if no custom cover
  const coverImage = playlist.coverUrl || playlist.tracks[0]?.coverUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Cover */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 mx-auto sm:mx-0">
          {coverImage ? (
            <img src={coverImage} alt={playlist.name} className="w-full h-full rounded-xl object-cover shadow-2xl" />
          ) : (
            <div className={`w-full h-full rounded-xl flex items-center justify-center shadow-2xl ${
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
            }`}>
              <Music size={64} className="text-zinc-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-end text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
            {playlist.isPublic ? (
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Globe size={12} /> Public Playlist
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Lock size={12} /> Private Playlist
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`text-2xl sm:text-4xl font-bold w-full bg-transparent border-b-2 focus:outline-none ${
                  theme === 'dark' ? 'border-zinc-700 focus:border-blue-500 text-white' : 'border-zinc-300 focus:border-blue-500 text-black'
                }`}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className={`w-full bg-transparent border rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500 resize-none ${
                  theme === 'dark' ? 'border-zinc-700 text-zinc-300 placeholder-zinc-600' : 'border-zinc-300 text-zinc-600 placeholder-zinc-400'
                }`}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-400"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(playlist.name);
                    setEditDescription(playlist.description || '');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className={`text-2xl sm:text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {playlist.name}
              </h1>
              {playlist.description && (
                <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {playlist.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500 justify-center sm:justify-start flex-wrap">
                <span>{playlist.trackCount} songs</span>
                <span>•</span>
                <span>{getTotalDuration()}</span>
                {playlist.likesCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Heart size={12} fill="currentColor" /> {playlist.likesCount}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => handlePlayAll(false)}
          disabled={playlist.tracks.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-full transition-colors disabled:opacity-50"
        >
          <Play size={20} fill="white" />
          Play
        </button>
        <button
          onClick={() => handlePlayAll(true)}
          disabled={playlist.tracks.length === 0}
          className={`p-3 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-black'
          }`}
        >
          <Shuffle size={20} />
        </button>
        
        {isOwner && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-3 rounded-full transition-colors ${
                theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              <MoreHorizontal size={20} />
            </button>
            
            {showMenu && (
              <div className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-lg overflow-hidden z-10 ${
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              }`}>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                    theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <Pencil size={16} />
                  Edit Details
                </button>
                <button
                  onClick={handleTogglePublic}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                    theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  {playlist.isPublic ? <Lock size={16} /> : <Globe size={16} />}
                  {playlist.isPublic ? 'Make Private' : 'Make Public'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Track List */}
      {playlist.tracks.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <Music size={48} className="mx-auto text-zinc-500 mb-3" />
          <p className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>This playlist is empty</p>
          <p className="text-zinc-500 text-sm mt-1">Add songs using the + button on the player</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {/* Header row */}
          <div className={`hidden sm:grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider border-b ${
            theme === 'dark' ? 'text-zinc-500 border-zinc-800' : 'text-zinc-400 border-zinc-200'
          }`}>
            <div className="w-8">#</div>
            <div>Title</div>
            <div>Album</div>
            <div className="w-16 text-right"><Clock size={14} /></div>
            <div className="w-8"></div>
          </div>

          {/* Tracks */}
          {playlist.tracks.map((track, index) => {
            const isCurrentTrack = currentlyPlayingId === track.trackId;
            
            return (
              <div
                key={track.id}
                draggable={isOwner}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => handlePlayTrack(track)}
                className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer group transition-colors ${
                  isCurrentTrack
                    ? theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
                    : theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                } ${draggedIndex === index ? 'opacity-50' : ''}`}
              >
                {/* Number / Drag handle */}
                <div className="w-8 flex items-center">
                  {isOwner && (
                    <GripVertical size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 cursor-grab mr-1" />
                  )}
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex gap-0.5">
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" />
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  ) : (
                    <span className={`text-sm ${isCurrentTrack ? 'text-blue-500' : 'text-zinc-500'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Title & Artist */}
                <div className="flex items-center gap-3 min-w-0">
                  <img src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${isCurrentTrack ? 'text-blue-500' : theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      {track.title}
                    </p>
                    <p className="text-zinc-500 text-sm truncate">{track.artistName || track.artistAddress.slice(0, 8) + '...'}</p>
                  </div>
                </div>

                {/* Album - hidden on mobile */}
                <div className="hidden sm:block text-zinc-500 text-sm truncate">
                  {track.releaseTitle}
                </div>

                {/* Duration */}
                <div className="w-16 text-right text-zinc-500 text-sm hidden sm:block">
                  {formatDuration(track.duration)}
                </div>

                {/* Remove button */}
                {isOwner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track.id);
                    }}
                    className="w-8 flex justify-center opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
