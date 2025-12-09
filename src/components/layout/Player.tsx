'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Repeat, Clock } from 'lucide-react';
import { Track } from '@/types';

interface PlayerProps {
  currentTrack: (Track & { artist?: string; cover?: string }) | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export default function Player({ currentTrack, isPlaying, setIsPlaying }: PlayerProps) {
  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-64 right-0 h-24 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 z-30">
        <div className="h-full flex items-center justify-center text-zinc-500">
          Select a track to play
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-64 right-0 h-24 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 z-30">
      <div className="h-full flex items-center justify-between px-6">
        {/* Track info */}
        <div className="flex items-center gap-4 w-1/4">
          <img
            src={currentTrack.cover || 'https://picsum.photos/seed/default/300/300'}
            alt=""
            className="w-16 h-16 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <h4 className="text-white font-medium truncate">{currentTrack.title}</h4>
            <p className="text-zinc-400 text-sm truncate">{currentTrack.artist}</p>
          </div>
          <button className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors">
            <Heart size={18} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-2 w-1/2">
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Repeat size={18} />
            </button>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <SkipBack size={20} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause size={24} className="text-black" />
              ) : (
                <Play size={24} className="text-black ml-1" fill="black" />
              )}
            </button>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <SkipForward size={20} />
            </button>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Clock size={18} />
            </button>
          </div>
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-zinc-500 text-xs">1:24</span>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden group cursor-pointer">
              <div className="w-1/3 h-full bg-emerald-500 rounded-full group-hover:bg-emerald-400 transition-colors" />
            </div>
            <span className="text-zinc-500 text-xs">{currentTrack.duration}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 w-1/4 justify-end">
          <Volume2 size={18} className="text-zinc-400" />
          <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
