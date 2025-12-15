'use client';

import { useState, useEffect } from 'react';
import { Settings, Wallet, Upload, DollarSign, Music } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { getReleasesByArtist, Release } from '@/lib/releases-store';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { theme } = useTheme();
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');
  const [isEditing, setIsEditing] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  
  // Profile data with localStorage persistence
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');

  // Load profile and releases on mount
  useEffect(() => {
    if (user?.wallet?.address) {
      // Load profile
      const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
      if (savedProfile) {
        const { name, bio } = JSON.parse(savedProfile);
        setDisplayName(name || '');
        setBio(bio || '');
      }
      
      // Load user's releases
      setReleases(getReleasesByArtist(user.wallet.address));
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

  const tabs = [
    { id: 'posted' as const, label: 'Your Releases', icon: Upload },
    { id: 'owned' as const, label: 'Owned NFTs', icon: Wallet },
    { id: 'sold' as const, label: 'Sold', icon: DollarSign },
  ];

  const getDisplayName = () => {
    if (displayName) return displayName;
    if (user?.wallet?.address) return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`;
    return 'Anonymous';
  };

  if (!user?.wallet?.address) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Wallet size={64} className="text-zinc-500 mb-4" />
        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          Connect Your Wallet
        </h2>
        <p className="text-zinc-500 text-center max-w-md">
          Connect your Xaman wallet to view your profile, releases, and owned NFTs.
        </p>
      </div>
    );
  }

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
                <p className="text-zinc-500 mt-1 flex items-center gap-2">
                  <Wallet size={14} />
                  {user.wallet.address.slice(0, 12)}...{user.wallet.address.slice(-8)}
                </p>
                {bio && (
                  <p className={`mt-3 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {bio}
                  </p>
                )}
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      {releases.length}
                    </p>
                    <p className="text-zinc-500 text-sm">Releases</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
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

      {profileTab === 'posted' && (
        <>
          {releases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Music size={48} className="text-zinc-500 mb-4" />
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                No Releases Yet
              </h3>
              <p className="text-zinc-500 text-center">
                Mint your first music NFT to see it here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {releases.map((release) => {
                const available = release.totalEditions - release.soldEditions;
                return (
                  <div key={release.id} className={`rounded-2xl overflow-hidden border group ${
                    theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}>
                    <div className="relative">
                      <img src={release.coverUrl} alt={release.title} className="w-full aspect-square object-cover" />
                      <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500/90 text-white text-xs font-bold rounded-full uppercase">
                        {release.type}
                      </div>
                      <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full text-blue-400 text-xs font-medium">
                        {available} available
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {release.title}
                      </h3>
                      <p className="text-zinc-500 text-sm mb-3">{release.tracks.length} tracks</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-blue-500 font-bold">{release.albumPrice || release.songPrice} XRP</span>
                        <span className="text-zinc-500 text-sm">{release.soldEditions} sold</span>
                      </div>
                      <div className="flex gap-2">
                        <button className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          theme === 'dark'
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                        }`}>
                          Edit
                        </button>
                        <button className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-sm font-medium transition-colors">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {profileTab === 'owned' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Wallet size={48} className="text-zinc-500 mb-4" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            No Owned NFTs
          </h3>
          <p className="text-zinc-500 text-center">
            Purchase music NFTs from the marketplace to see them here!
          </p>
        </div>
      )}

      {profileTab === 'sold' && (
        <div className="flex flex-col items-center justify-center py-12">
          <DollarSign size={48} className="text-zinc-500 mb-4" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            No Sales Yet
          </h3>
          <p className="text-zinc-500 text-center">
            When someone buys your music NFTs, they'll appear here!
          </p>
        </div>
      )}
    </div>
  );
}
