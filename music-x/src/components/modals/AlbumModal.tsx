'use client';

import { useState } from 'react';
import { X, Play, TrendingUp } from 'lucide-react';
import { Album, Track } from '@/types';

interface AlbumModalProps {
  album: Album | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (track: Track & { artist: string; cover: string }) => void;
}

export default function AlbumModal({ album, isOpen, onClose, onPlay }: AlbumModalProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'album' | number | null>(null);

  if (!isOpen || !album) return null;

  const totalTrackPrice = album.tracks.reduce((sum, t) => sum + t.price, 0);
  const albumSavings = totalTrackPrice - album.albumPrice;
  const lowestTrackAvailable = Math.min(...album.tracks.map(t => t.available));

  const handlePurchase = (type: 'album' | number) => {
    setPurchaseType(type);
    setPurchasing(true);
    setTimeout(() => {
      setPurchasing(false);
      setPurchaseType(null);
      // Would trigger actual purchase here
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden my-8 animate-slide-up">
        {/* Album Header */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={album.cover}
            alt={album.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black transition-colors z-10"
          >
            <X size={20} />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-6">
            <img
              src={album.cover}
              alt={album.title}
              className="w-40 h-40 rounded-xl shadow-2xl object-cover"
            />
            <div className="flex-1">
              <span className="text-emerald-400 text-sm font-medium uppercase tracking-wider">Album</span>
              <h2 className="text-3xl font-bold text-white mt-1">{album.title}</h2>
              <p className="text-zinc-300 text-lg">{album.artist}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-zinc-400">
                <span>{album.tracks.length} tracks</span>
                <span>•</span>
                <span>Released {album.releaseDate}</span>
                <span>•</span>
                <span>{album.totalMinted} editions minted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scarcity Alert Banner */}
        <div className="mx-6 mt-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
            <div>
              <h4 className="text-amber-400 font-semibold">Shared Inventory Pool</h4>
              <p className="text-zinc-400 text-sm mt-1">
                Only <span className="text-white font-bold">{album.completeAlbumsAvailable}</span> complete albums remain.
                Buying individual tracks reduces full album availability. Each purchase creates scarcity!
              </p>
            </div>
          </div>
        </div>

        {/* Purchase Options */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Buy Full Album */}
          <button
            onClick={() => !purchasing && handlePurchase('album')}
            className={`p-5 rounded-xl border-2 transition-all text-left ${
              purchaseType === 'album'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold text-white">Buy Complete Album</span>
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                SAVE {albumSavings} XRP
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-emerald-400">{album.albumPrice} XRP</p>
                <p className="text-zinc-500 text-sm line-through">{totalTrackPrice} XRP individual</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{album.completeAlbumsAvailable}</p>
                <p className="text-zinc-500 text-sm">available</p>
              </div>
            </div>
            {purchasing && purchaseType === 'album' && (
              <div className="mt-4 flex items-center gap-2 text-emerald-400">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Processing on XRPL...</span>
              </div>
            )}
          </button>

          {/* Album Stats */}
          <div className="p-5 rounded-xl border border-zinc-700 bg-zinc-800/30">
            <span className="text-lg font-semibold text-white mb-3 block">Inventory Status</span>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Total Minted</span>
                <span className="text-white font-medium">{album.totalMinted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Complete Albums Left</span>
                <span className="text-emerald-400 font-bold">{album.completeAlbumsAvailable}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Limiting Track</span>
                <span className="text-amber-400 font-medium">
                  {album.tracks.find(t => t.available === lowestTrackAvailable)?.title}
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                  style={{ width: `${(album.completeAlbumsAvailable / album.totalMinted) * 100}%` }}
                />
              </div>
              <p className="text-zinc-500 text-xs text-center">
                {Math.round((album.completeAlbumsAvailable / album.totalMinted) * 100)}% of complete albums remaining
              </p>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="px-6 pb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tracks</h3>
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            {album.tracks.map((track, index) => {
              const isLimitingTrack = track.available === lowestTrackAvailable;
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors group ${
                    index !== album.tracks.length - 1 ? 'border-b border-zinc-800/50' : ''
                  }`}
                >
                  <span className="w-8 text-center text-zinc-500 font-medium group-hover:hidden">
                    {index + 1}
                  </span>
                  <button
                    onClick={() => onPlay({ ...track, artist: album.artist, cover: album.cover })}
                    className="w-8 text-center hidden group-hover:block"
                  >
                    <Play size={16} className="text-white mx-auto" fill="white" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{track.title}</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500">{track.duration}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500">{track.plays.toLocaleString()} plays</span>
                    </div>
                  </div>

                  {/* Availability indicators */}
                  <div className="flex items-center gap-2">
                    {isLimitingTrack && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                        Limiting
                      </span>
                    )}
                    {track.available < album.completeAlbumsAvailable && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                        {album.completeAlbumsAvailable - track.available} sold individually
                      </span>
                    )}
                    <span className={`text-sm font-medium ${track.available < 20 ? 'text-red-400' : 'text-zinc-400'}`}>
                      {track.available} left
                    </span>
                  </div>

                  <span className="text-emerald-400 font-bold w-20 text-right">{track.price} XRP</span>

                  <button
                    onClick={() => handlePurchase(track.id)}
                    disabled={purchasing}
                    className="px-4 py-2 bg-zinc-700 hover:bg-emerald-500 hover:text-black text-white text-sm font-medium rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    {purchasing && purchaseType === track.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Buy'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 text-center">
            <p className="text-zinc-400 text-sm">
              <span className="text-emerald-400 font-medium">2% platform fee</span> on all sales supports the Music X DAO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
