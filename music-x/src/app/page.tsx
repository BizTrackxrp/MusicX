'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Player from '@/components/layout/Player';
import AuthModal from '@/components/modals/AuthModal';
import CreateModal from '@/components/modals/CreateModal';
import AlbumModal from '@/components/modals/AlbumModal';
import Messenger from '@/components/modals/Messenger';
import StreamPage from '@/components/pages/StreamPage';
import MarketplacePage from '@/components/pages/MarketplacePage';
import ProfilePage from '@/components/pages/ProfilePage';
import { Track, Album } from '@/types';
import { getAllTracks } from '@/lib/mock-data';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<'stream' | 'marketplace' | 'profile'>('stream');
  const [user, setUser] = useState<{ email?: string; wallet?: { type: 'xumm' | 'bifrost'; address: string } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentTrack, setCurrentTrack] = useState<(Track & { artist?: string; cover?: string }) | null>(getAllTracks()[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const handlePlayTrack = (track: Track & { artist?: string; cover?: string }) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/20 via-black to-zinc-950 pointer-events-none" />
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />

      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        onAuthClick={() => setShowAuth(true)}
        onCreateClick={() => setShowCreate(true)}
        onLogout={() => setUser(null)}
      />

      <main className="ml-64 min-h-screen pb-32">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onMessengerClick={() => setShowMessenger(true)}
        />
        <div className="p-8">
          {currentPage === 'stream' && <StreamPage onPlayTrack={handlePlayTrack} onSelectAlbum={setSelectedAlbum} />}
          {currentPage === 'marketplace' && <MarketplacePage viewMode={viewMode} setViewMode={setViewMode} onSelectAlbum={setSelectedAlbum} onPlayTrack={handlePlayTrack} />}
          {currentPage === 'profile' && <ProfilePage user={user} />}
        </div>
      </main>

      <Player currentTrack={currentTrack} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={setUser} />
      <CreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <AlbumModal album={selectedAlbum} isOpen={!!selectedAlbum} onClose={() => setSelectedAlbum(null)} onPlay={(t) => { setCurrentTrack(t); setIsPlaying(true); }} />
      <Messenger isOpen={showMessenger} onClose={() => setShowMessenger(false)} />
    </div>
  );
}
