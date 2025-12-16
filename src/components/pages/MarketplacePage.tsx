'use client';

import { useState, useEffect } from 'react';
import { Play, Grid, List, Filter, ShoppingBag } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Album, Track } from '@/types';

interface Release {
  id: string;
  type: string;
  title: string;
  description: string;
  artistAddress: string;
  artistName: string;
  coverUrl: string;
  songPrice: number;
  albumPrice?: number;
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

interface MarketplacePageProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onSelectAlbum: (album: Album) => void;
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
}

export default function MarketplacePage({ viewMode, setViewMode, onSelectAlbum, onPlayTrack }: MarketplacePageProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'all' | 'singles' | 'albums'>('all');
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
      setLoading(false);
    }
    loadReleases();

    // Listen for new releases
    const handleNewRelease = () => loadReleases();
    window.addEventListener('releaseCreated', handleNewRelease);
    return () => window.removeEventListener('releaseCreated', handleNewRelease);
  }, []);

  const filteredReleases = releases.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'singles') return r.type === 'single';
    if (activeTab === 'albums') return r.type === 'album';
    return true;
  });

  const handlePlayTrack = (release: Release, trackIndex: number = 0) => {
    const track = release.tracks[trackIndex];
    if (track) {
      onPlayTrack({
        id: parseInt(track.id) || 0,
        title: track.title,
        duration: track.duration?.toString() || '0:00',
        price: release.songPrice,
        available: release.totalEditions - release.soldEditions,
        plays: 0,
        mediaType: 'audio',
        ipfsHash: track.audioCid,
        artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
        cover: release.coverUrl,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          NFT Marketplace
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' 
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : theme === 'dark' ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-black'
            }`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' 
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : theme === 'dark' ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-black'
            }`}
          >
            <List size={20} />
          </button>
          <button className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            theme === 'dark' 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
              : 'bg-zinc-100 hover:bg-zinc-200 text-black'
          }`}>
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 sm:gap-2 border-b pb-1 overflow-x-auto ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {(['all', 'singles', 'albums'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 sm:px-5 py-2 sm:py-3 rounded-t-xl font-medium transition-colors capitalize whitespace-nowrap ${
              activeTab === tab
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab === 'all' ? 'All Releases' : tab}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredReleases.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <ShoppingBag size={48} className="text-zinc-500 mb-4" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            No Releases Yet
          </h3>
          <p className="text-zinc-500 text-center">
            {activeTab === 'all' 
              ? 'Be the first to mint music on XRP Music!' 
              : `No ${activeTab} available yet.`}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          {filteredReleases.map((release) => {
            const available = release.totalEditions - release.soldEditions;
            return (
              <div
                key={release.id}
                className={`group rounded-xl sm:rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700' 
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => handlePlayTrack(release)}
              >
                <div className="relative aspect-square">
                  <img 
                    src={release.coverUrl} 
                    alt={release.title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all">
                      <Play size={20} fill="white" className="text-white ml-0.5" />
                    </button>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/90 text-white text-xs font-bold rounded-full uppercase">
                    {release.type}
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                    {available} left
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className={`font-semibold truncate text-sm sm:text-base ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {release.title}
                  </h3>
                  <p className="text-zinc-500 text-xs sm:text-sm truncate">
                    {release.artistName || `${release.artistAddress.slice(0, 6)}...`}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-blue-500 font-bold text-sm">
                      {release.type === 'album' ? release.albumPrice : release.songPrice} XRP
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {release.tracks.length} track{release.tracks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className={`rounded-xl sm:rounded-2xl border overflow-hidden ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {filteredReleases.map((release, index) => {
            const available = release.totalEditions - release.soldEditions;
            return (
              <div
                key={release.id}
                onClick={() => handlePlayTrack(release)}
                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors group ${
                  theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                } ${index !== filteredReleases.length - 1 ? (
                  theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100'
                ) : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <img 
                    src={release.coverUrl} 
                    alt={release.title} 
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
                    <Play size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      {release.title}
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-xs font-medium rounded-full uppercase flex-shrink-0">
                      {release.type}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-sm truncate">
                    {release.artistName || `${release.artistAddress.slice(0, 6)}...`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-blue-500 font-bold">
                    {release.type === 'album' ? release.albumPrice : release.songPrice} XRP
                  </p>
                  <p className="text-zinc-500 text-xs">{available} left</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
