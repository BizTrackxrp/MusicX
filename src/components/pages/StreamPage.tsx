'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Music, Wallet, ChevronRight } from 'lucide-react';
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

  const allTracks = releases.flatMap(release => 
    release.tracks.map((track, idx) => ({
      ...track,
      release,
      trackIndex: idx,
      displayTitle: release.type === 'single' ? release.title : track.title,
    }))
  );

  if (releases.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Music size={32} className="text-white" />
          </div>
          <h1 className="text-main text-2xl font-bold mb-2">Welcome to XRP Music</h1>
          <p className="text-secondary text-base mb-6">The decentralized music platform on the XRP Ledger</p>
          <div className="bg-card p-4 rounded-xl">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-secondary">Connect your Xaman wallet to get started</p>
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
        <h2 className="text-main text-2xl font-bold mb-4">Latest Releases</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {releases.slice(0, 12).map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isSoldOut = available <= 0;
            
            return (
              <div
                key={release.id}
                onClick={() => setSelectedRelease(release)}
                className="bg-card p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className={`relative aspect-square rounded-lg overflow-hidden mb-3 ${isSoldOut ? 'opacity-50' : ''}`}>
                  {release.coverUrl ? (
                    <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Music size={32} className="text-gray-500" />
                    </div>
                  )}
                  
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
                
                <h3 className="text-main font-bold text-sm truncate">{release.title}</h3>
                <p className="text-secondary text-sm truncate">{getArtistDisplay(release)}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-blue-500 font-bold text-sm">{release.albumPrice || release.songPrice} XRP</span>
                  <span className={`text-xs ${isSoldOut ? 'text-red-500' : available < 10 ? 'text-orange-500' : 'text-secondary'}`}>
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
          <h2 className="text-main text-2xl font-bold mb-4">All Tracks</h2>
          
          <div className="bg-card rounded-xl overflow-hidden">
            {allTracks.map((trackData, index) => {
              const release = trackData.release;
              const available = release.totalEditions - release.soldEditions;
              const isSoldOut = available <= 0;
              const isThisPlaying = parseInt(trackData.id) === currentlyPlayingId;

              return (
                <div
                  key={`${release.id}-${trackData.id}`}
                  onClick={() => !isSoldOut && handlePlayTrack(release, trackData, trackData.trackIndex)}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:opacity-80 transition-opacity ${
                    isSoldOut ? 'opacity-50 cursor-not-allowed' : ''
                  } ${index !== allTracks.length - 1 ? 'border-b border-white/10' : ''}`}
                >
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img src={release.coverUrl} alt={trackData.displayTitle} className="w-full h-full rounded object-cover" />
                    {isThisPlaying && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-4 bg-green-500 animate-pulse rounded"></div>
                          <div className="w-1 h-3 bg-green-500 animate-pulse rounded"></div>
                          <div className="w-1 h-4 bg-green-500 animate-pulse rounded"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isThisPlaying ? 'text-green-500' : 'text-main'}`}>
                      {trackData.displayTitle}
                    </p>
                    <p className="text-secondary text-sm truncate">{getArtistDisplay(release)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSoldOut ? (
                      <span className="text-xs font-medium text-red-500">Sold</span>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-500">{release.songPrice} XRP</p>
                          <p className={`text-xs ${available < 10 ? 'text-orange-500' : 'text-secondary'}`}>{available} left</p>
                        </div>
                        <ChevronRight size={16} className="text-secondary" />
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
          <div key={stat.label} className="bg-card p-4 rounded-xl text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-secondary">{stat.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
