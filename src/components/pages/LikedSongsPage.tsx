'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Shuffle, Heart, Music, Clock } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';
import { Track } from '@/types';

interface LikedTrack {
  trackId: string;
  releaseId: string;
  title: string;
  releaseTitle: string;
  releaseType: string;
  artistName: string;
  artistAddress: string;
  coverUrl: string;
  audioUrl: string;
  audioCid: string;
  duration: number;
  songPrice: number;
  totalEditions: number;
  soldEditions: number;
  likedAt: string;
}

interface LikedSongsPageProps {
  onPlayTrack: (track: Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) => void;
  onPlayAll: (tracks: (Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string })[], shuffle?: boolean) => void;
  currentlyPlayingId?: string | null;
  isPlaying?: boolean;
  onLikedCountChange?: (count: number) => void;
}

export default function LikedSongsPage({ onPlayTrack, onPlayAll, currentlyPlayingId, isPlaying, onLikedCountChange }: LikedSongsPageProps) {
  const { theme } = useTheme();
  const { user } = useXaman();
  const [tracks, setTracks] = useState<LikedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLikedTracks();
  }, [user?.address]);

  const loadLikedTracks = async () => {
    if (!user?.address) {
      setTracks([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/likes?user=${user.address}`);
      const data = await res.json();
      if (data.success && data.tracks) {
        setTracks(data.tracks);
        if (onLikedCountChange) {
          onLikedCountChange(data.tracks.length);
        }
      }
    } catch (error) {
      console.error('Failed to load liked tracks:', error);
    }
    setLoading(false);
  };

  const handlePlayAll = (shuffle = false) => {
    if (!tracks.length) return;
    
    const playTracks = tracks.map(t => ({
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
    
    onPlayAll(playTracks, shuffle);
  };

  const handlePlayTrack = (track: LikedTrack) => {
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

  const handleUnlike = async (trackId: string) => {
    if (!user?.address) return;
    
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlike',
          userAddress: user.address,
          trackId,
        }),
      });
      
      setTracks(prev => {
        const newTracks = prev.filter(t => t.trackId !== trackId);
        if (onLikedCountChange) {
          onLikedCountChange(newTracks.length);
        }
        return newTracks;
      });
    } catch (error) {
      console.error('Failed to unlike track:', error);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!tracks.length) return '0 min';
    const total = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Cover - gradient with heart */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 mx-auto sm:mx-0">
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-700 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
            <Heart size={80} className="text-white" fill="white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-end text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Playlist</p>
          <h1 className={`text-3xl sm:text-5xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Liked Songs
          </h1>
          <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500 justify-center sm:justify-start">
            <span>{tracks.length} songs</span>
            <span>•</span>
            <span>{getTotalDuration()}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handlePlayAll(false)}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-full transition-colors disabled:opacity-50"
        >
          <Play size={20} fill="white" />
          Play
        </button>
        <button
          onClick={() => handlePlayAll(true)}
          disabled={tracks.length === 0}
          className={`p-3 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-black'
          }`}
        >
          <Shuffle size={20} />
        </button>
      </div>

      {/* Track List */}
      {tracks.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <Heart size={48} className="mx-auto text-zinc-500 mb-3" />
          <p className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>Songs you like will appear here</p>
          <p className="text-zinc-500 text-sm mt-1">Save songs by tapping the heart icon</p>
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
          {tracks.map((track, index) => {
            const isCurrentTrack = currentlyPlayingId === track.trackId;
            
            return (
              <div
                key={track.trackId}
                onClick={() => handlePlayTrack(track)}
                className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer group transition-colors ${
                  isCurrentTrack
                    ? theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
                    : theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                }`}
              >
                {/* Number */}
                <div className="w-8 flex items-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex gap-0.5">
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" />
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  ) : (
                    <>
                      <span className={`group-hover:hidden text-sm ${isCurrentTrack ? 'text-blue-500' : 'text-zinc-500'}`}>
                        {index + 1}
                      </span>
                      <Play size={14} className={`hidden group-hover:block ${theme === 'dark' ? 'text-white' : 'text-black'}`} fill="currentColor" />
                    </>
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

                {/* Unlike button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlike(track.trackId);
                  }}
                  className="w-8 flex justify-center text-pink-500 hover:text-pink-400 transition-colors"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

