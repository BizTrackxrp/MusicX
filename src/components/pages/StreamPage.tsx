'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Music, Wallet, Disc3, TrendingUp, Sparkles, Clock, ChevronRight } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Album, Track } from '@/types';
import AlbumModal from '@/components/modals/AlbumModal';

interface Release {
  id: string;
  type: string;
  title: string;
  description: string;
  artistAddress: string;
  artistName: string;
  coverUrl: string;
  coverCid: string;
  songPrice: number;
  albumPrice: number;
  totalEditions: number;
  soldEditions: number;
  createdAt?: string;
  tracks: Array<{
    id: string;
    title: string;
    audioUrl: string;
    audioCid: string;
    duration?: number;
  }>;
}

interface StreamPageProps {
  onPlayTrack: (track: Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) => void;
  onSelectAlbum: (album: Album) => void;
  currentlyPlayingId?: number | null;
  isPlaying?: boolean;
}

export default function StreamPage({ onPlayTrack, onSelectAlbum, currentlyPlayingId, isPlaying }: StreamPageProps) {
  const { theme } = useTheme();
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  useEffect(() => {
    async function loadReleases() {
      try {
        const res = await fetch('/api/releases');
        const data = await res.json();
        if (data.success && data.releases) {
          setReleases(data.releases);
        }
      } catch (error) {
        console.error('Failed to load releases:', error);
        const stored = localStorage.getItem('xrpmusic_releases');
        if (stored) {
          setReleases(JSON.parse(stored));
        }
      }
    }
    loadReleases();

    const handleNewRelease = () => loadReleases();
    window.addEventListener('releaseCreated', handleNewRelease);
    return () => window.removeEventListener('releaseCreated', handleNewRelease);
  }, []);

  const handlePlayTrack = (release: Release, track: Release['tracks'][0], index: number) => {
    const available = release.totalEditions - release.soldEditions;
    onPlayTrack({
      id: parseInt(track.id) || index,
      title: release.type === 'single' ? release.title : track.title,
      duration: formatDuration(track.duration),
      price: release.songPrice,
      available: available,
      plays: 0,
      mediaType: 'audio',
      ipfsHash: track.audioCid,
      artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
      cover: release.coverUrl,
      releaseId: release.id,
      trackId: track.id,
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '3:30';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getArtistDisplay = (release: Release): string => {
    return release.artistName || `${release.artistAddress.slice(0, 6)}...${release.artistAddress.slice(-4)}`;
  };

  // Build flat track list
  const allTracks = releases.flatMap(release => 
    release.tracks.map((track, idx) => ({
      ...track,
      release,
      trackIndex: idx,
      displayTitle: release.type === 'single' ? release.title : track.title,
    }))
  );

  // Empty state
  if (releases.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Music size={32} className="text-white" />
          </div>

          <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            Welcome to XRP Music
          </h1>
          
          <p className={`text-sm sm:text-base mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            The decentralized music platform on the XRP Ledger
          </p>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <Disc3 className="w-6 h-6 mx-auto mb-1 text-blue-500" />
              <p className={`font-medium text-xs ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Mint</p>
            </div>
            <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <TrendingUp className="w-6 h-6 mx-auto mb-1 text-green-500" />
              <p className={`font-medium text-xs ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Earn</p>
            </div>
            <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <Sparkles className="w-6 h-6 mx-auto mb-1 text-purple-500" />
              <p className={`font-medium text-xs ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Collect</p>
            </div>
          </div>

          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/80 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'}`}>
            <Wallet className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
              Connect your Xaman wallet to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Album Modal */}
      <AlbumModal
        isOpen={selectedRelease !== null}
        onClose={() => setSelectedRelease(null)}
        release={selectedRelease}
        onPlay={onPlayTrack}
        currentlyPlayingId={currentlyPlayingId}
      />

      {/* Latest Releases - Horizontal scroll on mobile, grid on desktop */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-lg sm:text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            Latest Releases
          </h2>
          {releases.length > 5 && (
            <button className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
              See all
            </button>
          )}
        </div>
        
        {/* Mobile: Horizontal scroll | Desktop: Grid */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:overflow-visible">
          {releases.slice(0, 12).map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isSoldOut = available <= 0;
            const isCurrentlyPlaying = release.tracks.some(t => parseInt(t.id) === currentlyPlayingId);
            
            return (
              <div
                key={release.id}
                className={`flex-shrink-0 w-32 sm:w-auto rounded-lg p-2 transition-colors cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-zinc-900/50 hover:bg-zinc-800/80' 
                    : 'bg-white hover:bg-zinc-50 border border-zinc-200'
                }`}
                onClick={() => setSelectedRelease(release)}
              >
                {/* Cover Art - Small on mobile */}
                <div className={`relative aspect-square rounded-md overflow-hidden mb-2 ${
                  isSoldOut ? 'opacity-50' : ''
                }`}>
                  {release.coverUrl ? (
                    <img 
                      src={release.coverUrl} 
                      alt={release.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}>
                      <Music size={24} className="text-zinc-500" />
                    </div>
                  )}
                  
                  {/* Play button overlay - always visible when playing */}
                  {isCurrentlyPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        {isPlaying ? (
                          <Pause size={18} fill="white" className="text-white" />
                        ) : (
                          <Play size={18} fill="white" className="text-white ml-0.5" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <div className={`absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                    release.type === 'album' 
                      ? 'bg-purple-500 text-white' 
                      : release.type === 'ep'
                        ? 'bg-blue-500 text-white'
                        : 'bg-emerald-500 text-white'
                  }`}>
                    {release.type}
                  </div>
                  
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded uppercase">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Info - Always visible */}
                <div className="space-y-0.5">
                  <h3 className={`font-semibold text-xs sm:text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    {release.title}
                  </h3>
                  <p className={`text-[10px] sm:text-xs truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {getArtistDisplay(release)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-bold text-blue-500">
                      {release.albumPrice || release.songPrice} XRP
                    </span>
                    <span className={`text-[9px] sm:text-[10px] ${
                      isSoldOut ? 'text-red-400' : available < 10 ? 'text-amber-400' : theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                    }`}>
                      {isSoldOut ? 'Sold' : `${available} left`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All Tracks - Compact rows like Spotify mobile */}
      {allTracks.length > 0 && (
        <section>
          <h2 className={`text-lg sm:text-xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            All Tracks
          </h2>
          
          <div className="space-y-1">
            {allTracks.map((trackData, index) => {
              const release = trackData.release;
              const track = trackData;
              const trackIndex = trackData.trackIndex;
              const displayTitle = trackData.displayTitle;
              
              const available = release.totalEditions - release.soldEditions;
              const isSoldOut = available <= 0;
              const trackId = `${release.id}-${track.id}`;
              const isThisPlaying = parseInt(track.id) === currentlyPlayingId;

              return (
                <div
                  key={trackId}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                    isThisPlaying 
                      ? theme === 'dark' ? 'bg-zinc-800' : 'bg-blue-50'
                      : theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100'
                  } ${isSoldOut ? 'opacity-50' : ''}`}
                  onClick={() => !isSoldOut && handlePlayTrack(release, track, trackIndex)}
                >
                  {/* Album Art - Small square */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img 
                      src={release.coverUrl} 
                      alt={displayTitle}
                      className="w-full h-full rounded object-cover"
                    />
                    {isThisPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                        {isPlaying ? (
                          <div className="flex gap-0.5 items-end h-4">
                            <div className="w-0.5 h-full bg-green-500 rounded-full animate-pulse" />
                            <div className="w-0.5 h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                            <div className="w-0.5 h-full bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                          </div>
                        ) : (
                          <Pause size={16} className="text-white" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${
                      isThisPlaying 
                        ? 'text-green-500' 
                        : theme === 'dark' ? 'text-white' : 'text-zinc-900'
                    }`}>
                      {displayTitle}
                    </p>
                    <p className={`text-xs truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {getArtistDisplay(release)}
                    </p>
                  </div>

                  {/* Price & Play indicator */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSoldOut ? (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                      }`}>
                        Sold
                      </span>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-blue-500">{release.songPrice} XRP</p>
                          <p className={`text-[10px] ${available < 10 ? 'text-amber-400' : theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {available} left
                          </p>
                        </div>
                        <ChevronRight size={16} className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Stats - Compact */}
      <section className="grid grid-cols-4 gap-2">
        <div className={`p-3 rounded-lg text-center ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white border border-zinc-200'}`}>
          <p className="text-lg sm:text-xl font-bold text-blue-500">{releases.length}</p>
          <p className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Releases</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white border border-zinc-200'}`}>
          <p className="text-lg sm:text-xl font-bold text-purple-500">{allTracks.length}</p>
          <p className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Tracks</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white border border-zinc-200'}`}>
          <p className="text-lg sm:text-xl font-bold text-green-500">
            {new Set(releases.map(r => r.artistAddress)).size}
          </p>
          <p className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Artists</p>
        </div>
        <div className={`p-3 rounded-lg text-center ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white border border-zinc-200'}`}>
          <p className="text-lg sm:text-xl font-bold text-amber-500">
            {releases.reduce((acc, r) => acc + r.soldEditions, 0)}
          </p>
          <p className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Sold</p>
        </div>
      </section>
    </div>
  );
}
