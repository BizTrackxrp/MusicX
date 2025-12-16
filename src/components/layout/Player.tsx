'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { Track } from '@/types';

interface PlayerProps {
  currentTrack: (Track & { artist?: string; cover?: string }) | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export default function Player({ currentTrack, isPlaying, setIsPlaying }: PlayerProps) {
  const { theme } = useTheme();
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, setIsPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isNaN(percent) ? 0 : percent);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = percent * audioRef.current.duration;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if no track
  if (!currentTrack) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack?.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Mobile Expanded Player */}
      {isExpanded && (
        <div className={`fixed inset-0 z-50 flex flex-col lg:hidden ${
          theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setIsExpanded(false)} className="p-2">
              <ChevronDown size={24} className={theme === 'dark' ? 'text-white' : 'text-black'} />
            </button>
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Now Playing</span>
            <div className="w-10" />
          </div>

          {/* Album Art */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl">
              {currentTrack?.cover ? (
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-6xl">🎵</span>
                </div>
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="px-8 text-center">
            <h2 className={`text-2xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              {currentTrack?.title || 'Unknown Track'}
            </h2>
            <p className="text-zinc-500 text-lg">{currentTrack?.artist || 'Unknown Artist'}</p>
          </div>

          {/* Progress */}
          <div className="px-8 mt-6">
            <div 
              className={`h-1 rounded-full cursor-pointer ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`}
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-blue-500 rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm text-zinc-500">
              <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
              <span>{formatTime(audioRef.current?.duration || 0)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 py-8">
            <button className={`p-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              <Shuffle size={24} />
            </button>
            <button className={`p-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              <SkipBack size={28} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white"
            >
              {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </button>
            <button className={`p-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              <SkipForward size={28} />
            </button>
            <button className={`p-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              <Repeat size={24} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-4 pb-8">
            <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* Mini Player Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors ${
        theme === 'dark' 
          ? 'bg-zinc-900/95 border-zinc-800' 
          : 'bg-white/95 border-zinc-200'
      }`}>
        {/* Progress bar */}
        <div 
          className={`h-1 cursor-pointer ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}
          onClick={handleSeek}
        >
          <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="lg:ml-64 h-16 lg:h-20 px-4 flex items-center gap-4">
          {/* Track Info - Clickable on mobile to expand */}
          <button 
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-3 flex-1 min-w-0 lg:pointer-events-none text-left"
          >
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden flex-shrink-0">
              {currentTrack?.cover ? (
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-lg">🎵</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-medium truncate text-sm lg:text-base ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {currentTrack?.title || 'Select a track to play'}
              </p>
              <p className="text-zinc-500 text-xs lg:text-sm truncate">
                {currentTrack?.artist || 'Browse the marketplace'}
              </p>
            </div>
            {/* Mobile expand indicator */}
            <ChevronUp size={20} className={`lg:hidden ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`} />
          </button>

          {/* Desktop Controls */}
          <div className="hidden lg:flex items-center gap-4">
            <button className={`p-2 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>
              <SkipBack size={20} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center text-white transition-colors"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button className={`p-2 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>
              <SkipForward size={20} />
            </button>
          </div>

          {/* Mobile Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white lg:hidden"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          {/* Desktop Volume */}
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-zinc-300">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </>
  );
}
