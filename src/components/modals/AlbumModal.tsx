'use client';

import { X, Play, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Album, Track } from '@/types';

interface AlbumModalProps {
  album: Album | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (track: Track & { artist?: string; cover?: string }) => void;
}

export default function AlbumModal({ album, isOpen, onClose, onPlay }: AlbumModalProps) {
  const { theme } = useTheme();
  
  if (!isOpen || !album) return null;

  const lowestTrackAvailable = Math.min(...album.tracks.map(t => t.available));
  const limitingTrack = album.tracks.find(t => t.available === lowestTrackAvailable);
  const isLowStock = album.completeAlbumsAvailable < 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden my-8 animate-slide-up ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        {isLowStock && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-b border-red-500/30 px-6 py-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <span className="font-medium">Only {album.completeAlbumsAvailable} complete albums remaining!</span>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 p-6">
            <img src={album.cover} alt={album.title} className="w-full aspect-square object-cover rounded-xl shadow-lg" />
            <div className="mt-4">
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{album.title}</h2>
              <p className="text-zinc-500 text-lg">{album.artist}</p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Complete Albums</span>
                  <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{album.completeAlbumsAvailable} / {album.totalMinted}</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                  <div
                    className={`h-full rounded-full ${isLowStock ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'}`}
                    style={{ width: `${(album.completeAlbumsAvailable / album.totalMinted) * 100}%` }}
                  />
                </div>
              </div>

              {limitingTrack && lowestTrackAvailable < album.totalMinted && (
                <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                  theme === 'dark' ? 'bg-zinc-800/50 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  <TrendingUp size={14} />
                  <span>Limiting track: "{limitingTrack.title}" ({lowestTrackAvailable} left)</span>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                <ShoppingCart size={18} />
                Buy Album - {album.albumPrice} XRP
              </button>
              <p className="text-center text-zinc-500 text-xs">
                Save {Math.round((1 - album.albumPrice / album.tracks.reduce((sum, t) => sum + t.price, 0)) * 100)}% vs buying tracks individually
              </p>
            </div>
          </div>

          <div className={`md:w-2/3 border-l ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {album.tracks.length} Tracks
              </h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {album.tracks.map((track, index) => {
                const soldIndividually = track.available < album.totalMinted;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-4 p-4 transition-colors ${
                      theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                    } ${index !== album.tracks.length - 1 ? (theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100') : ''}`}
                  >
                    <span className="w-8 text-center text-zinc-500">{index + 1}</span>
                    <button
                      onClick={() => onPlay({ ...track, artist: album.artist, cover: album.cover })}
                      className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{track.title}</p>
                      <p className="text-zinc-500 text-sm">{track.duration}</p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="text-zinc-500 text-xs">Available</p>
                      <p className={`font-medium ${track.available < 30 ? 'text-red-400' : theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {track.available}
                        {soldIndividually && <span className="text-orange-400 text-xs ml-1">*</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-500 font-bold">{track.price} XRP</p>
                      <button className={`text-xs transition-colors ${
                        theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                      }`}>Buy Track</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {album.tracks.some(t => t.available < album.totalMinted) && (
              <div className={`p-3 text-xs flex items-center gap-2 ${
                theme === 'dark' ? 'bg-zinc-800/30 text-zinc-500' : 'bg-zinc-50 text-zinc-500'
              }`}>
                <span className="text-orange-400">*</span>
                <span>Tracks marked with * have been sold individually, reducing complete album availability</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
