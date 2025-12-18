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

  // Direct color values - no CSS variables, no Tailwind
  const textColor = theme === 'dark' ? '#ffffff' : '#000000';
  const mutedColor = theme === 'dark' ? '#d4d4d8' : '#52525b';  // Lighter gray for dark mode
  const cardBg = theme === 'dark' ? '#27272a' : '#ffffff';  // Solid colors
  const cardBorder = theme === 'dark' ? '#3f3f46' : '#e4e4e7';

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
            <Music size={32} color="#ffffff" />
          </div>
          <h1 style={{ color: textColor, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Welcome to XRP Music
          </h1>
          <p style={{ color: mutedColor, fontSize: 16, marginBottom: 24 }}>
            The decentralized music platform on the XRP Ledger
          </p>
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, padding: 16, borderRadius: 12 }}>
            <Wallet style={{ width: 32, height: 32, margin: '0 auto 8px', color: '#3b82f6' }} />
            <p style={{ color: mutedColor }}>Connect your Xaman wallet to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <AlbumModal
        isOpen={selectedRelease !== null}
        onClose={() => setSelectedRelease(null)}
        release={selectedRelease}
        onPlay={onPlayTrack}
        currentlyPlayingId={currentlyPlayingId}
      />

      {/* Latest Releases */}
      <section>
        <h2 style={{ color: textColor, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
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
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  padding: 12,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', marginBottom: 12, opacity: isSoldOut ? 0.5 : 1 }}>
                  {release.coverUrl ? (
                    <img src={release.coverUrl} alt={release.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#27272a' }}>
                      <Music size={32} color="#71717a" />
                    </div>
                  )}
                  
                  <span style={{
                    position: 'absolute', top: 8, left: 8,
                    padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 4,
                    textTransform: 'uppercase', color: '#ffffff',
                    background: release.type === 'album' ? '#a855f7' : release.type === 'ep' ? '#3b82f6' : '#22c55e'
                  }}>
                    {release.type}
                  </span>
                  
                  {isSoldOut && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                      <span style={{ padding: '4px 12px', background: '#ef4444', color: '#ffffff', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>SOLD OUT</span>
                    </div>
                  )}
                </div>
                
                <h3 style={{ color: textColor, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {release.title}
                </h3>
                <p style={{ color: mutedColor, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                  {getArtistDisplay(release)}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: 13 }}>
                    {release.albumPrice || release.songPrice} XRP
                  </span>
                  <span style={{ color: isSoldOut ? '#ef4444' : available < 10 ? '#f97316' : mutedColor, fontSize: 12 }}>
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
          <h2 style={{ color: textColor, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
            All Tracks
          </h2>
          
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
            {allTracks.map((trackData, index) => {
              const release = trackData.release;
              const available = release.totalEditions - release.soldEditions;
              const isSoldOut = available <= 0;
              const isThisPlaying = parseInt(trackData.id) === currentlyPlayingId;

              return (
                <div
                  key={`${release.id}-${trackData.id}`}
                  onClick={() => !isSoldOut && handlePlayTrack(release, trackData, trackData.trackIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    cursor: isSoldOut ? 'not-allowed' : 'pointer',
                    opacity: isSoldOut ? 0.5 : 1,
                    borderBottom: index !== allTracks.length - 1 ? `1px solid ${cardBorder}` : 'none',
                  }}
                >
                  <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                    <img src={release.coverUrl} alt={trackData.displayTitle} style={{ width: '100%', height: '100%', borderRadius: 6, objectFit: 'cover' }} />
                    {isThisPlaying && isPlaying && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <div style={{ width: 3, height: 16, background: '#22c55e', borderRadius: 2 }}></div>
                          <div style={{ width: 3, height: 12, background: '#22c55e', borderRadius: 2 }}></div>
                          <div style={{ width: 3, height: 16, background: '#22c55e', borderRadius: 2 }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 100, overflow: 'hidden' }}>
                    <p style={{ color: isThisPlaying ? '#22c55e' : textColor, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {trackData.displayTitle}
                    </p>
                    <p style={{ color: mutedColor, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getArtistDisplay(release)}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSoldOut ? (
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#ef4444' }}>Sold</span>
                    ) : (
                      <>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{release.songPrice} XRP</p>
                          <p style={{ fontSize: 11, color: available < 10 ? '#f97316' : mutedColor }}>{available} left</p>
                        </div>
                        <ChevronRight size={16} color={mutedColor} />
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
          { label: 'Releases', value: releases.length, color: '#3b82f6' },
          { label: 'Tracks', value: allTracks.length, color: '#a855f7' },
          { label: 'Artists', value: new Set(releases.map(r => r.artistAddress)).size, color: '#22c55e' },
          { label: 'Sold', value: releases.reduce((acc, r) => acc + r.soldEditions, 0), color: '#f97316' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: cardBg, border: `1px solid ${cardBorder}`, padding: 16, borderRadius: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            <p style={{ color: mutedColor }}>{stat.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
