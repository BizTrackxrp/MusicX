'use client';

import { useState, useEffect } from 'react';
import { Play, Grid, List, Filter, Music } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Album, Track } from '@/types';
import { getAllReleases, Release } from '@/lib/releases-store';

interface MarketplacePageProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onSelectAlbum: (album: Album) => void;
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
}

export default function MarketplacePage({ viewMode, setViewMode, onSelectAlbum, onPlayTrack }: MarketplacePageProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'all' | 'albums' | 'singles'>('all');
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    setReleases(getAllReleases());
  }, []);

  const albums = releases.filter(r => r.type === 'album');
  const singles = releases.filter(r => r.type === 'single');

  const displayReleases = activeTab === 'all' ? releases : activeTab === 'albums' ? albums : singles;

  // Convert Release to Album format for compatibility
  const releaseToAlbum = (release: Release): Album => ({
    id: parseInt(release.id) || Date.now(),
    title: release.title,
    artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
    cover: release.coverUrl,
    releaseDate: release.createdAt,
    description: release.description,
    totalMinted: release.totalEditions,
    completeAlbumsAvailable: release.totalEditions - release.soldEditions,
    albumPrice: release.albumPrice || release.songPrice,
    creatorAddress: release.artistAddress,
    tracks: release.tracks.map((t, i) => ({
      id: i,
      title: t.title,
      duration: t.duration ? `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}` : '0:00',
      price: release.songPrice,
      available: release.totalEditions - release.soldEditions,
      plays: 0,
      mediaType: 'audio' as const,
      ipfsHash: t.audioCid,
      cover: release.coverUrl,
      artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
    })),
  });

  if (releases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>NFT Marketplace</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <Music size={64} className="text-zinc-500 mb-4" />
          <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            No NFTs Listed Yet
          </h3>
          <p className="text-zinc-500 text-center max-w-md">
            Be the first to mint and list your music NFTs on the XRP Ledger!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>NFT Marketplace</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            <List size={20} />
          </button>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-black'
          }`}>
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      <div className={`flex gap-2 border-b pb-1 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {(['all', 'albums', 'singles'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 rounded-t-xl font-medium transition-colors capitalize ${
              activeTab === tab
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            {tab} {tab === 'all' ? `(${releases.length})` : tab === 'albums' ? `(${albums.length})` : `(${singles.length})`}
          </button>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayReleases.map((release) => {
            const available = release.totalEditions - release.soldEditions;
            const isLowStock = available < 10;
            const album = releaseToAlbum(release);
            
            return (
              <div
                key={release.id}
                onClick={() => onSelectAlbum(album)}
                className={`rounded-2xl overflow-hidden border transition-all group cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-blue-500/50'
                    : 'bg-white border-zinc-200 hover:border-blue-500/50'
                }`}
              >
                <div className="relative">
                  <img src={release.coverUrl} alt={release.title} className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500/90 text-white text-xs font-bold rounded-full uppercase">
                    {release.type}
                  </div>
                  {isLowStock && available > 0 && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-red-500/90 text-white text-xs font-bold rounded-full">
                      Only {available} left!
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const track = release.tracks[0];
                        if (track) {
                          onPlayTrack({
                            id: 0,
                            title: track.title,
                            duration: '0:00',
                            price: release.songPrice,
                            available,
                            plays: 0,
                            mediaType: 'audio',
                            cover: release.coverUrl,
                            artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
                          } as any);
                        }
                      }}
                      className="p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20"
                    >
                      <Play size={20} className="text-white" fill="white" />
                    </button>
                    <button className="px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-full text-white text-sm font-semibold">
                      Buy Now
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {release.title}
                  </h3>
                  <p className="text-zinc-500 text-sm mb-3">
                    {release.artistName || release.artistAddress.slice(0, 8) + '...'}
                  </p>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500">Available</span>
                      <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>
                        {available}/{release.totalEditions}
                      </span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                      <div
                        className={`h-full rounded-full ${isLowStock ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'}`}
                        style={{ width: `${(available / release.totalEditions) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-zinc-500 text-xs">Price</p>
                      <p className="text-blue-500 font-bold">{release.albumPrice || release.songPrice} XRP</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs">Tracks</p>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {release.tracks.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'dark' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {displayReleases.map((release, index) => {
            const available = release.totalEditions - release.soldEditions;
            return (
              <div
                key={release.id}
                className={`flex items-center gap-4 p-4 transition-colors cursor-pointer ${
                  theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                } ${index !== displayReleases.length - 1 ? (theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100') : ''}`}
                onClick={() => onSelectAlbum(releaseToAlbum(release))}
              >
                <img src={release.coverUrl} alt={release.title} className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {release.title}
                  </h4>
                  <p className="text-zinc-500 text-sm truncate">
                    {release.artistName || release.artistAddress.slice(0, 8) + '...'} • {release.tracks.length} tracks
                  </p>
                </div>
                <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-medium uppercase">
                  {release.type}
                </div>
                <div className="text-center px-4">
                  <p className="text-zinc-500 text-xs">Available</p>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {available}/{release.totalEditions}
                  </p>
                </div>
                <div className="text-center px-4">
                  <p className="text-zinc-500 text-xs">Price</p>
                  <p className="text-blue-500 font-bold">{release.albumPrice || release.songPrice} XRP</p>
                </div>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="px-5 py-2 bg-blue-500 hover:bg-blue-400 rounded-xl text-white font-semibold transition-colors"
                >
                  Buy
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
