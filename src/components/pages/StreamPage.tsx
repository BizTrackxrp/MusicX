'use client';

import { useState, useEffect } from 'react';
import { Play, Music, Wallet, Disc3, TrendingUp, Sparkles, ShoppingCart } from 'lucide-react';
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
  tracks: Array<{
    id: string;
    title: string;
    audioUrl: string;
    audioCid: string;
    duration?: number;
  }>;
}

interface StreamPageProps {
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
  onSelectAlbum: (album: Album) => void;
  currentlyPlayingId?: number | null;
}

export default function StreamPage({ onPlayTrack, onSelectAlbum, currentlyPlayingId }: StreamPageProps) {
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
        // Fallback to localStorage
        const stored = localStorage.getItem('xrpmusic_releases');
        if (stored) {
          setReleases(JSON.parse(stored));
        }
      }
    }
    loadReleases();

    // Listen for new releases
    const handleNewRelease = () => loadReleases();
    window.addEventListener('releaseCreated', handleNewRelease);
    return () => window.removeEventListener('releaseCreated', handleNewRelease);
  }, []);

  const handlePlayRelease = (release: Release) => {
    if (release.tracks.length > 0) {
      const releaseTrack = release.tracks[0];
      onPlayTrack({
        id: parseInt(releaseTrack.id) || 0,
        title: releaseTrack.title,
        duration: releaseTrack.duration?.toString() || '0:00',
        price: release.songPrice,
        available: release.totalEditions - release.soldEditions,
        plays: 0,
        mediaType: 'audio',
        ipfsHash: releaseTrack.audioCid,
        artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
        cover: release.coverUrl,
      });
    }
  };

  const handleBuyTrack = (e: React.MouseEvent, release: Release, trackIndex: number) => {
    e.stopPropagation();
    // TODO: Implement buy flow
    console.log('Buy track:', release.tracks[trackIndex]?.title || release.title);
    alert('Buy flow coming soon! 🚀');
  };

  // Empty state - show when no releases
  if (releases.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        {/* Hero Section */}
        <div className="text-center max-w-lg mx-auto">
          {/* Logo/Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Music size={40} className="text-white sm:w-12 sm:h-12" />
          </div>

          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Welcome to XRP Music
          </h1>
          
          <p className={`text-base sm:text-lg mb-8 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            The decentralized music platform on the XRP Ledger. Mint, collect, and stream exclusive music NFTs.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <Disc3 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Mint Music</h3>
              <p className="text-zinc-500 text-xs mt-1">Create limited edition NFTs</p>
            </div>
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Earn Royalties</h3>
              <p className="text-zinc-500 text-xs mt-1">Get paid on every resale</p>
            </div>
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Collect & Stream</h3>
              <p className="text-zinc-500 text-xs mt-1">Own exclusive releases</p>
            </div>
          </div>

          {/* CTA */}
          <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-zinc-900/80 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'}`}>
            <Wallet className="w-10 h-10 mx-auto mb-3 text-blue-500" />
            <h3 className={`font-semibold text-lg mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Get Started
            </h3>
            <p className="text-zinc-500 text-sm mb-4">
              Connect your Xaman wallet to start minting and collecting music NFTs
            </p>
            <p className="text-zinc-600 text-xs">
              Tap the <span className="font-medium">☰ menu</span> or <span className="text-blue-500 font-medium">Connect</span> button above
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Latest Releases
          </h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          {releases.slice(0, 10).map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isSoldOut = available <= 0;
            
            return (
              <div
                key={release.id}
                className={`group rounded-xl sm:rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700' 
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setSelectedRelease(release)}
              >
                <div className="relative aspect-square">
                  <img 
                    src={release.coverUrl} 
                    alt={release.title} 
                    className={`w-full h-full object-cover ${isSoldOut ? 'opacity-50' : ''}`}
                  />
                  
                  {/* Hover play button */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayRelease(release);
                      }}
                    >
                      <Play size={20} fill="white" className="text-white ml-0.5" />
                    </button>
                  </div>
                  
                  {/* Type badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/90 text-white text-xs font-bold rounded-full uppercase">
                    {release.type}
                  </div>
                  
                  {/* Sold out badge */}
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-4 py-2 bg-black/80 text-white font-bold text-sm rounded-lg uppercase tracking-wide">
                        Sold Out
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Card info - always visible */}
                <div className="p-3 sm:p-4">
                  <h3 className={`font-semibold truncate text-sm sm:text-base ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {release.title}
                  </h3>
                  <p className={`text-xs sm:text-sm truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {release.artistName || `${release.artistAddress.slice(0, 6)}...`}
                  </p>
                  
                  {/* Price and availability - always visible */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
                    <span className="text-blue-500 font-bold text-sm">
                      {release.albumPrice || release.songPrice} XRP
                    </span>
                    <span className={`text-xs font-medium ${
                      isSoldOut 
                        ? 'text-red-500' 
                        : available < 10 
                          ? 'text-amber-500' 
                          : theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
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
      {releases.length > 0 && (
        <section>
          <h2 className={`text-xl sm:text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            All Tracks
          </h2>
          <div className={`rounded-xl sm:rounded-2xl border overflow-hidden ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            {releases.flatMap((release, releaseIndex) =>
              release.tracks.map((track, trackIndex) => {
                const available = release.totalEditions - release.soldEditions;
                const isSoldOut = available <= 0;
                const globalIndex = releases.slice(0, releaseIndex).reduce((acc, r) => acc + r.tracks.length, 0) + trackIndex;
                const totalTracks = releases.reduce((acc, r) => acc + r.tracks.length, 0);
                
                return (
                  <div
                    key={`${release.id}-${track.id}`}
                    onClick={() => !isSoldOut && onPlayTrack({
                      id: parseInt(track.id) || 0,
                      title: release.type === 'single' ? release.title : track.title,
                      duration: track.duration?.toString() || '0:00',
                      price: release.songPrice,
                      available: available,
                      plays: 0,
                      mediaType: 'audio',
                      ipfsHash: track.audioCid,
                      artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
                      cover: release.coverUrl,
                    })}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 transition-colors group ${
                      isSoldOut 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer'
                    } ${
                      theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                    } ${globalIndex !== totalTracks - 1 ? (
                      theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100'
                    ) : ''}`}
                  >
                    {/* Album art with play overlay */}
                    <div className="relative flex-shrink-0">
                      <img 
                        src={release.coverUrl} 
                        alt={track.title} 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover"
                      />
                      {!isSoldOut && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
                          <Play size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate text-sm sm:text-base ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {release.type === 'single' ? release.title : track.title}
                      </h4>
                      <p className={`text-xs sm:text-sm truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {release.artistName || `${release.artistAddress.slice(0, 6)}...`}
                      </p>
                    </div>
                    
                    {/* Availability */}
                    <div className={`hidden sm:block text-xs font-medium px-2 py-1 rounded-full ${
                      isSoldOut 
                        ? 'bg-red-500/20 text-red-400' 
                        : available < 10 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : theme === 'dark' 
                            ? 'bg-zinc-800 text-zinc-400' 
                            : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {isSoldOut ? 'Sold Out' : `${available} left`}
                    </div>
                    
                    {/* Buy button */}
                    <button 
                      onClick={(e) => !isSoldOut && handleBuyTrack(e, release, trackIndex)}
                      disabled={isSoldOut}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex-shrink-0 ${
                        isSoldOut
                          ? theme === 'dark' 
                            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                            : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-400 text-white'
                      }`}
                    >
                      {isSoldOut ? (
                        'Sold Out'
                      ) : (
                        <>
                          <ShoppingCart size={14} />
                          {release.songPrice} XRP
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
