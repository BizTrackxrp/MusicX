'use client';

import { useState } from 'react';
import { X, Play, ShoppingCart, Share2, Check, Music, ExternalLink } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Track } from '@/types';

interface Release {
  id: string;
  type: string;
  title: string;
  description?: string;
  artistAddress: string;
  artistName: string;
  coverUrl: string;
  songPrice: number;
  albumPrice?: number;
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

interface AlbumModalProps {
  release: Release | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (track: Track & { artist?: string; cover?: string }) => void;
  currentlyPlayingId?: number | null;
}

export default function AlbumModal({ release, isOpen, onClose, onPlay, currentlyPlayingId }: AlbumModalProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  
  if (!isOpen || !release) return null;

  const available = release.totalEditions - release.soldEditions;
  const isAlbum = release.type === 'album';
  const totalIndividualPrice = release.tracks.length * release.songPrice;
  const albumSavings = isAlbum && release.albumPrice ? totalIndividualPrice - release.albumPrice : 0;

  const handlePlayTrack = (trackIndex: number) => {
    const track = release.tracks[trackIndex];
    if (track) {
      onPlay({
        id: parseInt(track.id) || trackIndex,
        title: isAlbum ? track.title : release.title,
        duration: track.duration?.toString() || '0:00',
        price: release.songPrice,
        available: available,
        plays: 0,
        mediaType: 'audio',
        ipfsHash: track.audioCid,
        artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
        cover: release.coverUrl,
      });
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://xrpmusic.io/release/${release.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl border shadow-2xl overflow-hidden my-4 ${
        theme === 'dark'
          ? 'bg-zinc-900 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header with cover art */}
          <div className="relative">
            {/* Background blur from cover */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110"
              style={{ backgroundImage: `url(${release.coverUrl})` }}
            />
            <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-gradient-to-b from-transparent via-zinc-900/80 to-zinc-900' : 'bg-gradient-to-b from-transparent via-white/80 to-white'}`} />
            
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
              {/* Cover Art */}
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <img 
                  src={release.coverUrl} 
                  alt={release.title}
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl shadow-2xl object-cover"
                />
              </div>
              
              {/* Release Info */}
              <div className="flex-1 flex flex-col justify-end text-center sm:text-left">
                <p className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {release.type}
                </p>
                <h1 className={`text-2xl sm:text-4xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {release.title}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                  <a 
                    href={`/artist/${release.artistAddress}`}
                    className={`font-medium hover:underline ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                  >
                    {release.artistName || `${release.artistAddress.slice(0, 6)}...${release.artistAddress.slice(-4)}`}
                  </a>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-500">
                    {release.createdAt ? new Date(release.createdAt).getFullYear() : new Date().getFullYear()}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-500">
                    {release.tracks.length} {release.tracks.length === 1 ? 'song' : 'songs'}
                  </span>
                </div>
                
                {release.description && (
                  <p className={`mt-4 text-sm max-w-xl ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {release.description}
                  </p>
                )}

                {/* Availability */}
                <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm self-center sm:self-start ${
                  available < 10 
                    ? 'bg-red-500/20 text-red-400' 
                    : theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {available < 10 ? '🔥' : '📀'} {available} of {release.totalEditions} available
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className={`px-6 sm:px-8 py-4 flex flex-wrap items-center gap-3 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <button
              onClick={() => handlePlayTrack(0)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-full transition-colors"
            >
              <Play size={20} fill="white" />
              Play
            </button>
            
            {isAlbum && release.albumPrice ? (
              <button className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-full transition-colors">
                <ShoppingCart size={18} />
                Buy Album • {release.albumPrice} XRP
              </button>
            ) : (
              <button className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-full transition-colors">
                <ShoppingCart size={18} />
                Buy • {release.songPrice} XRP
              </button>
            )}
            
            <button
              onClick={copyLink}
              className={`p-3 rounded-full transition-colors ${
                copied 
                  ? 'bg-green-500/20 text-green-500' 
                  : theme === 'dark' 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                    : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
              title="Share"
            >
              {copied ? <Check size={20} /> : <Share2 size={20} />}
            </button>

            {/* Album savings badge */}
            {isAlbum && albumSavings > 0 && (
              <div className="ml-auto text-sm">
                <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}>
                  Save <span className="text-green-500 font-semibold">{albumSavings} XRP</span> with album
                </span>
              </div>
            )}
          </div>

          {/* Track list */}
          <div className="px-6 sm:px-8 py-4">
            <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {isAlbum ? 'Tracks' : 'Track'}
            </div>
            
            <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
              {release.tracks.map((track, index) => {
                const isPlaying = currentlyPlayingId === parseInt(track.id);
                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors group cursor-pointer ${
                      isPlaying 
                        ? theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
                        : theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                    } ${index !== release.tracks.length - 1 ? (
                      theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-zinc-100'
                    ) : ''}`}
                    onClick={() => handlePlayTrack(index)}
                  >
                    {/* Track number / Play button */}
                    <div className="w-8 flex items-center justify-center">
                      {isPlaying ? (
                        <div className="flex gap-0.5">
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" />
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                        </div>
                      ) : (
                        <>
                          <span className={`group-hover:hidden ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            {index + 1}
                          </span>
                          <Play size={16} className={`hidden group-hover:block ${theme === 'dark' ? 'text-white' : 'text-black'}`} fill="currentColor" />
                        </>
                      )}
                    </div>
                    
                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        isPlaying 
                          ? 'text-blue-500' 
                          : theme === 'dark' ? 'text-white' : 'text-black'
                      }`}>
                        {isAlbum ? track.title : release.title}
                      </p>
                      <p className="text-sm text-zinc-500 truncate">
                        {release.artistName || release.artistAddress.slice(0, 8) + '...'}
                      </p>
                    </div>
                    
                    {/* Duration */}
                    <span className={`hidden sm:block text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {formatDuration(track.duration)}
                    </span>
                    
                    {/* Buy button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Buy single track logic
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                        theme === 'dark' 
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                          : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                      }`}
                    >
                      {release.songPrice} XRP
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className={`px-6 sm:px-8 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <a 
              href={`/artist/${release.artistAddress}`}
              className={`inline-flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'} transition-colors`}
            >
              <Music size={16} />
              View artist page
              <ExternalLink size={14} />
            </a>
            
            {isAlbum && (
              <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Individual tracks: {release.tracks.length} × {release.songPrice} = {totalIndividualPrice} XRP
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
