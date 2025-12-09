'use client';

import { useState } from 'react';
import { Play, Grid, List, Filter, TrendingUp } from 'lucide-react';
import { Album, Track } from '@/types';
import { mockAlbums, mockSingles, getAllTracks } from '@/lib/mock-data';

interface MarketplacePageProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onSelectAlbum: (album: Album) => void;
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
}

export default function MarketplacePage({ viewMode, setViewMode, onSelectAlbum, onPlayTrack }: MarketplacePageProps) {
  const [activeTab, setActiveTab] = useState<'albums' | 'singles' | 'tracks'>('albums');
  const allTracks = getAllTracks();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">NFT Marketplace</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            <List size={20} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white transition-colors">
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        {(['albums', 'singles', 'tracks'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 rounded-t-xl font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Albums Grid */}
      {activeTab === 'albums' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockAlbums.map((album) => {
            const isLowStock = album.completeAlbumsAvailable < 30;
            return (
              <div
                key={album.id}
                onClick={() => onSelectAlbum(album)}
                className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800 hover:border-emerald-500/50 transition-all group cursor-pointer"
              >
                <div className="relative">
                  <img src={album.cover} alt={album.title} className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isLowStock && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-red-500/90 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <TrendingUp size={12} />
                      Only {album.completeAlbumsAvailable} left!
                    </div>
                  )}
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur text-white text-xs font-medium rounded-full">
                    {album.tracks.length} tracks
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold truncate">{album.title}</h3>
                  <p className="text-zinc-400 text-sm mb-3">{album.artist}</p>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500">Complete albums</span>
                      <span className="text-zinc-400">{album.completeAlbumsAvailable}/{album.totalMinted}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLowStock ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                        style={{ width: `${(album.completeAlbumsAvailable / album.totalMinted) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-zinc-500 text-xs">Album Price</p>
                      <p className="text-emerald-400 font-bold">{album.albumPrice} XRP</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs">Tracks from</p>
                      <p className="text-white font-medium">{Math.min(...album.tracks.map(t => t.price))} XRP</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Singles Grid */}
      {activeTab === 'singles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockSingles.map((single) => (
            <div key={single.id} className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800 hover:border-emerald-500/50 transition-all group">
              <div className="relative">
                <img src={single.cover} alt={single.title} className="w-full aspect-square object-cover" />
                <div className="absolute top-3 right-3 px-2 py-1 bg-purple-500/90 text-white text-xs font-bold rounded-full">
                  SINGLE
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onPlayTrack(single)}
                    className="p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20"
                  >
                    <Play size={20} className="text-white" fill="white" />
                  </button>
                  <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-full text-black text-sm font-semibold">
                    Buy Now
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-white font-semibold truncate">{single.title}</h3>
                <p className="text-zinc-400 text-sm mb-3">{single.artist}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-xs">Price</p>
                    <p className="text-emerald-400 font-bold">{single.price} XRP</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-500 text-xs">Available</p>
                    <p className="text-white font-medium">{single.available}/{single.quantity}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Tracks List */}
      {activeTab === 'tracks' && (
        <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800 overflow-hidden">
          {allTracks.map((track, index) => (
            <div
              key={track.id}
              className={`flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors ${
                index !== allTracks.length - 1 ? 'border-b border-zinc-800/50' : ''
              }`}
            >
              <img src={track.cover} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate">{track.title}</h4>
                <p className="text-zinc-400 text-sm truncate">{track.artist} • {track.album}</p>
              </div>
              <div className="text-center px-4">
                <p className="text-zinc-500 text-xs">Available</p>
                <p className="text-white font-medium">{track.available}</p>
              </div>
              <div className="text-center px-4">
                <p className="text-zinc-500 text-xs">Price</p>
                <p className="text-emerald-400 font-bold">{track.price} XRP</p>
              </div>
              <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-black font-semibold transition-colors">
                Buy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
