'use client';

import { useState } from 'react';
import { Settings, Wallet, Upload, DollarSign, Check } from 'lucide-react';
import { mockAlbums } from '@/lib/mock-data';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');

  // Mock owned/posted data from albums
  const postedTracks = mockAlbums.slice(0, 2).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));
  const ownedTracks = mockAlbums.slice(1, 3).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));
  const soldTracks = mockAlbums.slice(0, 1).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));

  const tabs = [
    { id: 'posted' as const, label: 'Posted by You', icon: Upload, data: postedTracks },
    { id: 'owned' as const, label: 'Owned NFTs', icon: Wallet, data: ownedTracks },
    { id: 'sold' as const, label: 'Sold', icon: DollarSign, data: soldTracks },
  ];

  const currentData = tabs.find(t => t.id === profileTab)?.data || [];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-start gap-6">
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-4xl font-bold text-black">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{user?.email || 'Anonymous'}</h2>
            {user?.wallet && (
              <p className="text-zinc-500 mt-1 flex items-center gap-2">
                <Wallet size={14} />
                {user.wallet.address.slice(0, 12)}...{user.wallet.address.slice(-8)}
              </p>
            )}
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold text-white">{postedTracks.length}</p>
                <p className="text-zinc-500 text-sm">Posted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{ownedTracks.length}</p>
                <p className="text-zinc-500 text-sm">Owned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">1.2K</p>
                <p className="text-zinc-500 text-sm">Followers</p>
              </div>
            </div>
          </div>
          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white flex items-center gap-2 transition-colors">
            <Settings size={16} />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProfileTab(tab.id)}
            className={`px-5 py-3 rounded-t-xl flex items-center gap-2 font-medium transition-colors ${
              profileTab === tab.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {currentData.map((track) => (
          <div key={track.id} className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800 group">
            <div className="relative">
              <img src={track.cover} alt={track.title} className="w-full aspect-square object-cover" />
              {profileTab === 'posted' && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full text-emerald-400 text-xs font-medium">
                  {track.available} listed
                </div>
              )}
              {profileTab === 'sold' && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-zinc-800/80 backdrop-blur rounded-full text-white text-xs font-medium flex items-center gap-1">
                  <Check size={12} />
                  Sold
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-white font-semibold truncate">{track.title}</h3>
              <p className="text-zinc-400 text-sm mb-3">{track.artist}</p>
              
              {profileTab === 'posted' && (
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm font-medium transition-colors">
                    Edit
                  </button>
                  <button className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-400 text-sm font-medium transition-colors">
                    View Sales
                  </button>
                </div>
              )}
              
              {profileTab === 'owned' && (
                <button className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-black text-sm font-semibold transition-colors">
                  List for Sale
                </button>
              )}
              
              {profileTab === 'sold' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Sold for</span>
                  <span className="text-emerald-400 font-bold">{track.price} XRP</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentData.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No items to display
        </div>
      )}
    </div>
  );
}
