'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Player from '@/components/layout/Player';
import AuthModal from '@/components/modals/AuthModal';
import CreateModal from '@/components/modals/CreateModal';
import Messenger from '@/components/modals/Messenger';
import StreamPage from '@/components/pages/StreamPage';
import MarketplacePage from '@/components/pages/MarketplacePage';
import ProfilePage from '@/components/pages/ProfilePage';
import { useTheme } from '@/lib/theme-context';
import { Track, Album } from '@/types';
import { getAllTracks } from '@/lib/mock-data';

export default function Home() {
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState<'stream' | 'marketplace' | 'profile'>('stream');
  const [user, setUser] = useState<{ email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentTrack, setCurrentTrack] = useState<(Track & { artist?: string; cover?: string }) | null>(getAllTracks()[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const handlePlayTrack = (track: Track & { artist?: string; cover?: string }) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  return (
    <div className={`min-h-screen transition-colors ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50 text-white'}`}>
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
        onLogout={() => setUser(null)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="ml-64 min-h-screen pb-32">
        <Header
          onMessagesClick={() => setShowMessenger(true)}
          onMenuClick={() => setSidebarOpen(true)}
          onAuthClick={() => setShowAuth(true)}
          isLoggedIn={!!user}
        />
        <div className="p-8">
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
        </div>
      </main>

      <Player currentTrack={currentTrack} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={setUser} />
      <CreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <Messenger isOpen={showMessenger} onClose={() => setShowMessenger(false)} />
    </div>
  );
}
