'use client';

import { Play, Heart, MoreHorizontal, TrendingUp } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Track, Album } from '@/types';
import { getFeaturedAlbums, getTrendingTracks } from '@/lib/mock-data';

interface StreamPageProps {
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
  onSelectAlbum: (album: Album) => void;
}

export default function StreamPage({ onPlayTrack, onSelectAlbum }: StreamPageProps) {
  const { theme } = useTheme();
  const featuredAlbums = getFeaturedAlbums();
  const trendingTracks = getTrendingTracks(10);

  return (
    <div className="space-y-8">
      <section>
        <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Featured Drops</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredAlbums.map((album) => (
            <div
              key={album.id}
              onClick={() => onSelectAlbum(album)}
              className={`group relative rounded-2xl p-4 transition-all cursor-pointer border ${
                theme === 'dark'
                  ? 'bg-zinc-900/50 hover:bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="relative mb-4">
                <img src={album.cover} alt={album.title} className="w-full aspect-square object-cover rounded-xl" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayTrack({ ...album.tracks[0], artist: album.artist, cover: album.cover });
                  }}
                  className="absolute bottom-3 right-3 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105"
                >
                  <Play size={24} fill="white" className="text-white ml-1" />
                </button>
                {album.completeAlbumsAvailable < 30 && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-red-500/90 text-white text-xs font-bold rounded-full">
                    Only {album.completeAlbumsAvailable} left!
                  </div>
                )}
              </div>
              <h3 className={`font-semibold text-lg truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{album.title}</h3>
              <p className="text-zinc-500 text-sm">{album.artist}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-blue-500 font-medium">{album.albumPrice} XRP</span>
                <span className="text-zinc-500 text-sm">{album.completeAlbumsAvailable}/{album.totalMinted} albums</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Trending Now</h2>
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'dark' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {trendingTracks.map((track, index) => (
            <div
              key={track.id}
              className={`flex items-center gap-4 p-4 transition-colors cursor-pointer group ${
                theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
              } ${index !== trendingTracks.length - 1 ? (theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100') : ''}`}
              onClick={() => onPlayTrack(track)}
            >
              <span className="w-8 text-center text-zinc-500 font-medium">{index + 1}</span>
              <img src={track.cover} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{track.title}</h4>
                <p className="text-zinc-500 text-sm truncate">{track.artist}</p>
              </div>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <TrendingUp size={14} />
                {track.plays?.toLocaleString()}
              </div>
              <span className="text-zinc-500">{track.duration}</span>
              <button onClick={(e) => e.stopPropagation()} className="p-2 text-zinc-500 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all">
                <Heart size={18} />
              </button>
              <button onClick={(e) => e.stopPropagation()} className="p-2 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                <MoreHorizontal size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
