'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Player from '@/components/layout/Player';
import StreamPage from '@/components/pages/StreamPage';
import MarketplacePage from '@/components/pages/MarketplacePage';
import ProfilePage from '@/components/pages/ProfilePage';
import AuthModal from '@/components/modals/AuthModal';
import CreateModal from '@/components/modals/CreateModal';
import AlbumModal from '@/components/modals/AlbumModal';
import Messenger from '@/components/modals/Messenger';
import { Album, Track } from '@/types';

export default function Home() {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState<'stream' | 'marketplace' | 'profile'>('stream');
  const [user, setUser] = useState<{ email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [currentTrack, setCurrentTrack] = useState<(Track & { artist?: string; cover?: string }) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Listen for navigation events from CreateModal
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      setCurrentPage(e.detail);
    };
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  const handleLogin = (loggedInUser: { email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } }) => {
    setUser(loggedInUser);
    setShowAuth(false);
  };

  const handlePlayTrack = (track: Track & { artist?: string; cover?: string }) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  return (
    <div className={`min-h-screen transition-colors ${
      theme === 'dark' 
        ? 'bg-black text-white' 
        : 'bg-slate-50 text-black'
    }`}>
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        onAuthClick={() => setShowAuth(true)}
        onCreateClick={() => setShowCreate(true)}
        onLogout={() => setUser(null)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:pl-64">
        <Header 
          onMessagesClick={() => setShowMessenger(true)} 
          onMenuClick={() => setSidebarOpen(true)}
          onAuthClick={() => setShowAuth(true)}
          isLoggedIn={!!user}
        />
        <main className={`min-h-[calc(100vh-64px)] p-4 lg:p-6 transition-colors ${
          currentTrack ? 'pb-24 lg:pb-28' : 'pb-6'
        } ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-zinc-900/50 to-black'
            : 'bg-gradient-to-b from-white to-slate-50'
        }`}>
          {currentPage === 'stream' && (
            <StreamPage onPlayTrack={handlePlayTrack} onSelectAlbum={setSelectedAlbum} />
          )}
          {currentPage === 'marketplace' && (
            <MarketplacePage
              viewMode={viewMode}
              setViewMode={setViewMode}
              onSelectAlbum={setSelectedAlbum}
              onPlayTrack={handlePlayTrack}
            />
          )}
          {currentPage === 'profile' && <ProfilePage user={user} />}
        </main>
      </div>
      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={handleLogin}
      />
      <CreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <AlbumModal
        album={selectedAlbum}
        isOpen={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
        onPlay={handlePlayTrack}
      />
      <Messenger isOpen={showMessenger} onClose={() => setShowMessenger(false)} />
    </div>
  );
}
