'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Player from '@/components/layout/Player';
import AuthModal from '@/components/modals/AuthModal';
import CreateModal from '@/components/modals/CreateModal';
import Messenger from '@/components/modals/Messenger';
import StreamPage from '@/components/pages/StreamPage';
import MarketplacePage from '@/components/pages/MarketplacePage';
import ProfilePage from '@/components/pages/ProfilePage';
import PlaylistPage from '@/components/pages/PlaylistPage';
import LikedSongsPage from '@/components/pages/LikedSongsPage';
import PublicPlaylistsPage from '@/components/pages/PublicPlaylistsPage';
import { useTheme } from '@/lib/theme-context';
import { useXaman } from '@/lib/xaman-context';
import { Track, Album } from '@/types';

// Page type includes new playlist pages
type PageType = 'stream' | 'marketplace' | 'profile' | 'playlist' | 'liked' | 'playlists-browse';

// Storage key for persisting current page
const PAGE_STORAGE_KEY = 'xrpmusic_current_page';

export default function Home() {
  const { theme } = useTheme();
  const { user: xamanUser } = useXaman();
  
  // Initialize page from localStorage
  const [currentPage, setCurrentPage] = useState<PageType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PAGE_STORAGE_KEY);
      if (saved === 'stream' || saved === 'marketplace' || saved === 'profile' || 
          saved === 'playlist' || saved === 'liked' || saved === 'playlists-browse') {
        return saved;
      }
    }
    return 'stream';
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentTrack, setCurrentTrack] = useState<(Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [likedCount, setLikedCount] = useState(0);
  
  // Queue and shuffle state
  const [queue, setQueue] = useState<(Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string })[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);

  // Create a user object that matches expected format from Xaman context
  const user = xamanUser ? { wallet: { type: 'xumm' as const, address: xamanUser.address } } : null;

  // Save page to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(PAGE_STORAGE_KEY, currentPage);
  }, [currentPage]);

  // Listen for navigation events (e.g., from CreateModal redirecting to profile)
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<string>) => {
      const page = event.detail;
      if (page === 'stream' || page === 'marketplace' || page === 'profile' || 
          page === 'playlist' || page === 'liked' || page === 'playlists-browse') {
        setCurrentPage(page as PageType);
      }
    };

    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  const handlePlayTrack = (track: Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string }) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handlePlayAll = (tracks: (Track & { artist?: string; cover?: string; releaseId?: string; trackId?: string })[], shuffle = false) => {
    if (tracks.length === 0) return;
    
    let playQueue = [...tracks];
    if (shuffle) {
      // Fisher-Yates shuffle
      for (let i = playQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playQueue[i], playQueue[j]] = [playQueue[j], playQueue[i]];
      }
      setIsShuffled(true);
    } else {
      setIsShuffled(false);
    }
    
    setQueue(playQueue);
    setQueueIndex(0);
    setCurrentTrack(playQueue[0]);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const nextIndex = (queueIndex + 1) % queue.length;
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  };

  const handlePrevious = () => {
    if (queue.length === 0) return;
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    setQueueIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
  };

  const handleShuffle = () => {
    if (queue.length === 0) return;
    
    if (isShuffled) {
      // Unshuffle - we'd need original order, for now just toggle
      setIsShuffled(false);
    } else {
      // Shuffle remaining queue
      const currentTrackInQueue = queue[queueIndex];
      const remainingTracks = queue.filter((_, i) => i !== queueIndex);
      
      for (let i = remainingTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
      }
      
      setQueue([currentTrackInQueue, ...remainingTracks]);
      setQueueIndex(0);
      setIsShuffled(true);
    }
  };

  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setCurrentPage('playlist');
  };

  const handleSelectRelease = (release: { id: string }) => {
    // Navigate to stream and the release modal will open
    setCurrentPage('stream');
    // Dispatch event to open release
    window.dispatchEvent(new CustomEvent('openRelease', { detail: release.id }));
  };

  return (
    <div className={`min-h-screen transition-colors ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50 text-black'}`}>
      {/* Background effects */}
      <div className={`fixed inset-0 pointer-events-none transition-colors ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-blue-950/20 via-black to-zinc-950' 
          : 'bg-gradient-to-br from-blue-50 via-slate-50 to-white'
      }`} />
      <div className={`fixed top-0 left-0 w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none ${
        theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-500/10'
      }`} />

      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        onAuthClick={() => setShowAuth(true)}
        onCreateClick={() => setShowCreate(true)}
        onLogout={() => {}}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectPlaylist={handleSelectPlaylist}
        selectedPlaylistId={selectedPlaylistId}
        likedCount={likedCount}
      />

      <main className="lg:ml-64 min-h-screen pb-32">
        <Header
          onMessagesClick={() => setShowMessenger(true)}
          onMenuClick={() => setSidebarOpen(true)}
          onAuthClick={() => setShowAuth(true)}
          isLoggedIn={!!user}
          onSelectRelease={handleSelectRelease}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          {currentPage === 'stream' && (
            <StreamPage 
              onPlayTrack={handlePlayTrack} 
              onSelectAlbum={setSelectedAlbum}
              currentlyPlayingId={currentTrack?.id || null}
            />
          )}
          {currentPage === 'marketplace' && (
            <MarketplacePage 
              viewMode={viewMode} 
              setViewMode={setViewMode} 
              onSelectAlbum={setSelectedAlbum} 
              onPlayTrack={handlePlayTrack}
              currentlyPlayingId={currentTrack?.id || null}
            />
          )}
          {currentPage === 'profile' && (
            <ProfilePage 
              user={user}
              onPlayTrack={handlePlayTrack}
              currentlyPlayingId={currentTrack?.id || null}
            />
          )}
          {currentPage === 'playlist' && selectedPlaylistId && (
            <PlaylistPage
              playlistId={selectedPlaylistId}
              onPlayTrack={handlePlayTrack}
              onPlayAll={handlePlayAll}
              currentlyPlayingId={currentTrack?.trackId || currentTrack?.id?.toString()}
              isPlaying={isPlaying}
            />
          )}
          {currentPage === 'liked' && (
            <LikedSongsPage
              onPlayTrack={handlePlayTrack}
              onPlayAll={handlePlayAll}
              currentlyPlayingId={currentTrack?.trackId || currentTrack?.id?.toString()}
              isPlaying={isPlaying}
              onLikedCountChange={setLikedCount}
            />
          )}
          {currentPage === 'playlists-browse' && (
            <PublicPlaylistsPage
              onSelectPlaylist={handleSelectPlaylist}
            />
          )}
        </div>
      </main>

      <Player 
        currentTrack={currentTrack} 
        isPlaying={isPlaying} 
        setIsPlaying={setIsPlaying}
        queue={queue}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onShuffle={handleShuffle}
        isShuffled={isShuffled}
      />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={() => {}} />
      <CreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <Messenger isOpen={showMessenger} onClose={() => setShowMessenger(false)} />
    </div>
  );
}

