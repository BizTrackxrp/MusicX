'use client';

import { useState, useEffect } from 'react';
import { Settings, Wallet, Upload, DollarSign, Check, X, Camera } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { mockAlbums } from '@/lib/mock-data';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { theme } = useTheme();
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');
  const [isEditing, setIsEditing] = useState(false);
  
  // Profile data with localStorage persistence
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');

  // Load profile from localStorage on mount
  useEffect(() => {
    if (user?.wallet?.address) {
      const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
      if (savedProfile) {
        const { name, bio } = JSON.parse(savedProfile);
        setDisplayName(name || '');
        setBio(bio || '');
      }
    }
  }, [user?.wallet?.address]);

  const handleEditClick = () => {
    setTempName(displayName);
    setTempBio(bio);
    setIsEditing(true);
  };

  const handleSave = () => {
    setDisplayName(tempName);
    setBio(tempBio);
    
    // Save to localStorage
    if (user?.wallet?.address) {
      localStorage.setItem(`profile_${user.wallet.address}`, JSON.stringify({
        name: tempName,
        bio: tempBio
      }));
    }
    
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const postedTracks = mockAlbums.slice(0, 2).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));
  const ownedTracks = mockAlbums.slice(1, 3).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));
  const soldTracks = mockAlbums.slice(0, 1).flatMap(a => a.tracks.slice(0, 2).map(t => ({ ...t, cover: a.cover, artist: a.artist })));

  const tabs = [
    { id: 'posted' as const, label: 'Posted by You', icon: Upload, data: postedTracks },
    { id: 'owned' as const, label: 'Owned NFTs', icon: Wallet, data: ownedTracks },
    { id: 'sold' as const, label: 'Sold', icon: DollarSign, data: soldTracks },
  ];

  const currentData = tabs.find(t => t.id === profileTab)?.data || [];

  // Get display name or fallback
  const getDisplayName = () => {
    if (displayName) return displayName;
    if (user?.wallet?.address) return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`;
    return 'Anonymous';
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-6 ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-4xl font-bold text-white">
              {displayName?.[0]?.toUpperCase() || user?.wallet?.address?.[0]?.toUpperCase() || 'X'}
            </div>
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Enter your display name"
                    className={`w-full mt-1 px-4 py-2 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Bio
                  </label>
                  <textarea
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    className={`w-full mt-1 px-4 py-2 rounded-xl border focus:outline-none focus:border-blue-500 resize-none ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-xl transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                      theme === 'dark'
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {getDisplayName()}
                </h2>
                {user?.wallet && (
                  <p className="text-zinc-500 mt-1 flex items-center gap-2">
                    <Wallet size={14} />
                    {user.wallet.address.slice(0, 12)}...{user.wallet.address.slice(-8)}
                  </p>
                )}
                {bio && (
                  <p className={`mt-3 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {bio}
                  </p>
                )}
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{postedTracks.length}</p>
                    <p className="text-zinc-500 text-sm">Posted</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{ownedTracks.length}</p>
                    <p className="text-zinc-500 text-sm">Owned</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
                    <p className="text-zinc-500 text-sm">Followers</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {!isEditing && (
            <button 
              onClick={handleEditClick}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                theme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
            >
              <Settings size={16} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className={`flex gap-2 border-b pb-1 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProfileTab(tab.id)}
            className={`px-5 py-3 rounded-t-xl flex items-center gap-2 font-medium transition-colors ${
              profileTab === tab.id
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {currentData.map((track) => (
          <div key={track.id} className={`rounded-2xl overflow-hidden border group ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <div className="relative">
              <img src={track.cover} alt={track.title} className="w-full aspect-square object-cover" />
              {profileTab === 'posted' && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full text-blue-400 text-xs font-medium">
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
              <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{track.title}</h3>
              <p className="text-zinc-500 text-sm mb-3">{track.artist}</p>
              
              {profileTab === 'posted' && (
                <div className="flex gap-2">
                  <button className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                  }`}>
                    Edit
                  </button>
                  <button className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-sm font-medium transition-colors">
                    View Sales
                  </button>
                </div>
              )}
              
              {profileTab === 'owned' && (
                <button className="w-full py-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-white text-sm font-semibold transition-colors">
                  List for Sale
                </button>
              )}
              
              {profileTab === 'sold' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Sold for</span>
                  <span className="text-blue-500 font-bold">{track.price} XRP</span>
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
