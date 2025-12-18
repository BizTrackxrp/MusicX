'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Music, Wallet, Disc3, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
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
  const isDark = theme === 'dark';
  
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
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Music size={32} className="text-white" />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-black'}`}>
            Welcome to XRP Music
          </h1>
          <p className={`text-base mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            The decentralized music platform on the XRP Ledger
          </p>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
            <Wallet className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
              Connect your Xaman wallet to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AlbumModal
        isOpen={selectedRelease !== null}
        onClose={() => setSelectedRelease(null)}
        release={selectedRelease}
        onPlay={onPlayTrack}
        currentlyPlayingId={currentlyPlayingId}
      />

      {/* Latest Releases */}
      <section>
        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
          Latest Releases
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {releases.slice(0, 12).map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isSoldOut = available <= 0;
            
            return (
              <div
                key={release.id}
                onClick={() => setSelectedRelease(release)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700' 
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {/* Cover */}
                <div className={`relative aspect-square rounded-lg overflow-hidden mb-3 ${isSoldOut ? 'opacity-50' : ''}`}>
                  {release.coverUrl ? (
                    <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-zinc-700' : 'bg-gray-200'}`}>
                      <Music size={32} className="text-gray-500" />
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded text-white uppercase ${
                    release.type === 'album' ? 'bg-purple-500' : release.type === 'ep' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {release.type}
                  </span>
                  
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">SOLD OUT</span>
                    </div>
                  )}
                </div>
                
                {/* Info - ALWAYS VISIBLE */}
                <h3 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-black'}`}>
                  {release.title}
                </h3>
                <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {getArtistDisplay(release)}
                </p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-blue-500 font-bold text-sm">
                    {release.albumPrice || release.songPrice} XRP
                  </span>
                  <span className={`text-xs ${isSoldOut ? 'text-red-500' : available < 10 ? 'text-orange-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isSoldOut ? 'Sold Out' : `${available} left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All Tracks */}
      {allTracks.length > 0 && (
        <section>
          <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-black'}`}>
            All Tracks
          </h2>
          
          <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-white border border-gray-200'}`}>
            {allTracks.map((trackData, index) => {
              const release = trackData.release;
              const available = release.totalEditions - release.soldEditions;
              const isSoldOut = available <= 0;
              const isThisPlaying = parseInt(trackData.id) === currentlyPlayingId;

              return (
                <div
                  key={`${release.id}-${trackData.id}`}
                  onClick={() => !isSoldOut && handlePlayTrack(release, trackData, trackData.trackIndex)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                    isSoldOut ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    isThisPlaying 
                      ? isDark ? 'bg-zinc-700' : 'bg-blue-50'
                      : isDark ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'
                  } ${
                    index !== allTracks.length - 1 ? (isDark ? 'border-b border-zinc-700' : 'border-b border-gray-100') : ''
                  }`}
                >
                  {/* Cover */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img src={release.coverUrl} alt={trackData.displayTitle} className="w-full h-full rounded object-cover" />
                    {isThisPlaying && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-4 bg-green-500 animate-pulse rounded"></div>
                          <div className="w-1 h-3 bg-green-500 animate-pulse rounded" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-1 h-4 bg-green-500 animate-pulse rounded" style={{animationDelay: '0.4s'}}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isThisPlaying ? 'text-green-500' : isDark ? 'text-white' : 'text-black'}`}>
                      {trackData.displayTitle}
                    </p>
                    <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {getArtistDisplay(release)}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSoldOut ? (
                      <span className="text-xs font-medium text-red-500 bg-red-500/20 px-2 py-1 rounded">Sold</span>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-500">{release.songPrice} XRP</p>
                          <p className={`text-xs ${available < 10 ? 'text-orange-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {available} left
                          </p>
                        </div>
                        <ChevronRight size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Releases', value: releases.length, color: 'text-blue-500' },
          { label: 'Tracks', value: allTracks.length, color: 'text-purple-500' },
          { label: 'Artists', value: new Set(releases.map(r => r.artistAddress)).size, color: 'text-green-500' },
          { label: 'Sold', value: releases.reduce((acc, r) => acc + r.soldEditions, 0), color: 'text-orange-500' },
        ].map((stat) => (
          <div key={stat.label} className={`p-4 rounded-xl text-center ${isDark ? 'bg-zinc-800' : 'bg-white border border-gray-200'}`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{stat.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
