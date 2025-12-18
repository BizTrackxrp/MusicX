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
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  // Colors based on theme
  const colors = {
    text: theme === 'dark' ? '#ffffff' : '#18181b',
    textMuted: theme === 'dark' ? '#a1a1aa' : '#71717a',
    textFaint: theme === 'dark' ? '#71717a' : '#a1a1aa',
    bg: theme === 'dark' ? 'rgba(24, 24, 27, 0.5)' : '#ffffff',
    bgHover: theme === 'dark' ? 'rgba(39, 39, 42, 0.8)' : '#f4f4f5',
    border: theme === 'dark' ? '#27272a' : '#e4e4e7',
    accent: '#3b82f6',
  };

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
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', maxWidth: '32rem', margin: '0 auto' }}>
          <div style={{ 
            width: 80, height: 80, margin: '0 auto 16px', borderRadius: 16,
            background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.25)'
          }}>
            <Music size={32} color="white" />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: colors.text }}>
            Welcome to XRP Music
          </h1>
          
          <p style={{ fontSize: 14, marginBottom: 24, color: colors.textMuted }}>
            The decentralized music platform on the XRP Ledger
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
            <div style={{ padding: 12, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
              <Disc3 style={{ width: 24, height: 24, margin: '0 auto 4px', color: '#3b82f6' }} />
              <p style={{ fontWeight: 500, fontSize: 12, color: colors.text }}>Mint</p>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
              <TrendingUp style={{ width: 24, height: 24, margin: '0 auto 4px', color: '#22c55e' }} />
              <p style={{ fontWeight: 500, fontSize: 12, color: colors.text }}>Earn</p>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
              <Sparkles style={{ width: 24, height: 24, margin: '0 auto 4px', color: '#a855f7' }} />
              <p style={{ fontWeight: 500, fontSize: 12, color: colors.text }}>Collect</p>
            </div>
          </div>

          <div style={{ padding: 16, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
            <Wallet style={{ width: 32, height: 32, margin: '0 auto 8px', color: '#3b82f6' }} />
            <p style={{ fontSize: 14, color: colors.textMuted }}>
              Connect your Xaman wallet to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Album Modal */}
      <AlbumModal
        isOpen={selectedRelease !== null}
        onClose={() => setSelectedRelease(null)}
        release={selectedRelease}
        onPlay={onPlayTrack}
        currentlyPlayingId={currentlyPlayingId}
      />

      {/* Latest Releases */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
            Latest Releases
          </h2>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16 
        }}>
          {releases.slice(0, 12).map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isSoldOut = available <= 0;
            const isCurrentlyPlaying = release.tracks.some(t => parseInt(t.id) === currentlyPlayingId);
            
            return (
              <div
                key={release.id}
                onClick={() => setSelectedRelease(release)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.background = colors.bg}
              >
                {/* Cover Art */}
                <div style={{ 
                  position: 'relative', 
                  aspectRatio: '1', 
                  borderRadius: 8, 
                  overflow: 'hidden',
                  marginBottom: 12,
                  opacity: isSoldOut ? 0.5 : 1
                }}>
                  {release.coverUrl ? (
                    <img 
                      src={release.coverUrl} 
                      alt={release.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ 
                      width: '100%', height: '100%', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: colors.bgHover
                    }}>
                      <Music size={32} color={colors.textMuted} />
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    padding: '2px 8px',
                    fontSize: 10, fontWeight: 700,
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    background: release.type === 'album' ? '#a855f7' : release.type === 'ep' ? '#3b82f6' : '#10b981',
                    color: 'white'
                  }}>
                    {release.type}
                  </div>
                  
                  {/* Sold out badge */}
                  {isSoldOut && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{
                        padding: '4px 12px',
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        fontSize: 11, fontWeight: 700,
                        borderRadius: 4,
                        textTransform: 'uppercase'
                      }}>
                        Sold Out
                      </span>
                    </div>
                  )}
                  
                  {/* Playing indicator */}
                  {isCurrentlyPlaying && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.4)'
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: '#22c55e',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isPlaying ? <Pause size={18} color="white" fill="white" /> : <Play size={18} color="white" fill="white" />}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div>
                  <h3 style={{ 
                    fontWeight: 600, 
                    fontSize: 14, 
                    color: colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 4
                  }}>
                    {release.title}
                  </h3>
                  <p style={{ 
                    fontSize: 12, 
                    color: colors.textMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 8
                  }}>
                    {getArtistDisplay(release)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
                      {release.albumPrice || release.songPrice} XRP
                    </span>
                    <span style={{ 
                      fontSize: 11, 
                      color: isSoldOut ? '#ef4444' : available < 10 ? '#f59e0b' : colors.textFaint 
                    }}>
                      {isSoldOut ? 'Sold Out' : `${available} left`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All Tracks */}
      {allTracks.length > 0 && (
        <section>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: colors.text }}>
            All Tracks
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                  onClick={() => !isSoldOut && handlePlayTrack(release, track, trackIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 8,
                    cursor: isSoldOut ? 'not-allowed' : 'pointer',
                    opacity: isSoldOut ? 0.5 : 1,
                    background: isThisPlaying ? (theme === 'dark' ? 'rgba(39, 39, 42, 0.8)' : '#eff6ff') : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => !isThisPlaying && (e.currentTarget.style.background = colors.bgHover)}
                  onMouseLeave={(e) => !isThisPlaying && (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Album Art */}
                  <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                    <img 
                      src={release.coverUrl} 
                      alt={displayTitle}
                      style={{ width: '100%', height: '100%', borderRadius: 6, objectFit: 'cover' }}
                    />
                    {isThisPlaying && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.4)', borderRadius: 6
                      }}>
                        {isPlaying ? (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
                            <div style={{ width: 3, height: '100%', background: '#22c55e', borderRadius: 2, animation: 'pulse 1s infinite' }} />
                            <div style={{ width: 3, height: '60%', background: '#22c55e', borderRadius: 2, animation: 'pulse 1s infinite 0.15s' }} />
                            <div style={{ width: 3, height: '100%', background: '#22c55e', borderRadius: 2, animation: 'pulse 1s infinite 0.3s' }} />
                          </div>
                        ) : (
                          <Pause size={16} color="white" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ 
                      fontWeight: 500, 
                      fontSize: 14, 
                      color: isThisPlaying ? '#22c55e' : colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {displayTitle}
                    </p>
                    <p style={{ 
                      fontSize: 12, 
                      color: colors.textMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {getArtistDisplay(release)}
                    </p>
                  </div>

                  {/* Price */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSoldOut ? (
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        padding: '4px 10px', borderRadius: 12,
                        background: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                        color: theme === 'dark' ? '#f87171' : '#dc2626'
                      }}>
                        Sold Out
                      </span>
                    ) : (
                      <>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>
                            {release.songPrice} XRP
                          </p>
                          <p style={{ fontSize: 11, color: available < 10 ? '#f59e0b' : colors.textFaint }}>
                            {available} left
                          </p>
                        </div>
                        <ChevronRight size={16} color={colors.textFaint} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Stats */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <div style={{ padding: 12, borderRadius: 8, textAlign: 'center', background: colors.bg, border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{releases.length}</p>
          <p style={{ fontSize: 11, color: colors.textFaint }}>Releases</p>
        </div>
        <div style={{ padding: 12, borderRadius: 8, textAlign: 'center', background: colors.bg, border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#a855f7' }}>{allTracks.length}</p>
          <p style={{ fontSize: 11, color: colors.textFaint }}>Tracks</p>
        </div>
        <div style={{ padding: 12, borderRadius: 8, textAlign: 'center', background: colors.bg, border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
            {new Set(releases.map(r => r.artistAddress)).size}
          </p>
          <p style={{ fontSize: 11, color: colors.textFaint }}>Artists</p>
        </div>
        <div style={{ padding: 12, borderRadius: 8, textAlign: 'center', background: colors.bg, border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
            {releases.reduce((acc, r) => acc + r.soldEditions, 0)}
          </p>
          <p style={{ fontSize: 11, color: colors.textFaint }}>Sold</p>
        </div>
      </section>
    </div>
  );
}
