'use client';

import { useState, useEffect } from 'react';
import { Play, Heart, MoreHorizontal, Music } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Track, Album } from '@/types';
import { getAllReleases, Release } from '@/lib/releases-store';

interface StreamPageProps {
  onPlayTrack: (track: Track & { artist?: string; cover?: string }) => void;
  onSelectAlbum: (album: Album) => void;
}

export default function StreamPage({ onPlayTrack, onSelectAlbum }: StreamPageProps) {
  const { theme } = useTheme();
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    setReleases(getAllReleases());
  }, []);

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

  // Get all tracks from all releases for trending
  const allTracks = releases.flatMap((release) =>
    release.tracks.map((t, i) => ({
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
      audioUrl: t.audioUrl,
    }))
  );

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Music size={64} className="text-zinc-500 mb-4" />
        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          No Music Yet
        </h2>
        <p className="text-zinc-500 text-center max-w-md">
          Be the first to mint your music on XRP Music! Connect your wallet and start creating.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          Latest Releases
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {releases.map((release) => {
            const album = releaseToAlbum(release);
            return (
              <div
                key={release.id}
                onClick={() => onSelectAlbum(album)}
                className={`group relative rounded-2xl p-4 transition-all cursor-pointer border ${
                  theme === 'dark'
                    ? 'bg-zinc-900/50 hover:bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                    : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="relative mb-4">
                  <img
                    src={release.coverUrl}
                    alt={release.title}
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allTracks.length > 0) {
                        onPlayTrack(allTracks[0] as any);
                      }
                    }}
                    className="absolute bottom-3 right-3 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105"
                  >
                    <Play size={24} fill="white" className="text-white ml-1" />
                  </button>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500/90 text-white text-xs font-bold rounded-full uppercase">
                    {release.type}
                  </div>
                </div>
                <h3 className={`font-semibold text-lg truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {release.title}
                </h3>
                <p className="text-zinc-500 text-sm">
                  {release.artistName || release.artistAddress.slice(0, 8) + '...'}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-blue-500 font-medium">
                    {release.albumPrice || release.songPrice} XRP
                  </span>
                  <span className="text-zinc-500 text-sm">
                    {release.totalEditions - release.soldEditions}/{release.totalEditions} available
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {allTracks.length > 0 && (
        <section>
          <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            All Tracks
          </h2>
          <div className={`rounded-2xl border overflow-hidden ${
            theme === 'dark' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            {allTracks.map((track, index) => (
              <div
                key={`${track.title}-${index}`}
                className={`flex items-center gap-4 p-4 transition-colors cursor-pointer group ${
                  theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                } ${index !== allTracks.length - 1 ? (theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100') : ''}`}
                onClick={() => onPlayTrack(track as any)}
              >
                <span className="w-8 text-center text-zinc-500 font-medium">{index + 1}</span>
                <img src={track.cover} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {track.title}
                  </h4>
                  <p className="text-zinc-500 text-sm truncate">{track.artist}</p>
                </div>
                <span className="text-blue-500 font-medium">{track.price} XRP</span>
                <span className="text-zinc-500">{track.duration}</span>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-zinc-500 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Heart size={18} />
                </button>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
