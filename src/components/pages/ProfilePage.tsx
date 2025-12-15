'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Wallet, Upload, DollarSign, Music, Camera, Palette, X, Check, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { getReleasesByArtist, Release } from '@/lib/releases-store';
import { uploadFileToIPFS } from '@/lib/ipfs';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
}

interface ProfileData {
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string;
  gradientStart: string;
  gradientEnd: string;
  useGradient: boolean;
}

const PRESET_GRADIENTS = [
  { name: 'Ocean', start: '#0066FF', end: '#00D4FF' },
  { name: 'Sunset', start: '#FF6B6B', end: '#FFE66D' },
  { name: 'Purple Haze', start: '#7B2FF7', end: '#F107A3' },
  { name: 'Forest', start: '#11998E', end: '#38EF7D' },
  { name: 'Fire', start: '#FF416C', end: '#FF4B2B' },
  { name: 'Midnight', start: '#232526', end: '#414345' },
  { name: 'Gold', start: '#F7971E', end: '#FFD200' },
  { name: 'Electric', start: '#4776E6', end: '#8E54E9' },
];

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', 
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#6366F1', '#A855F7', '#F43F5E',
];

export default function ProfilePage({ user }: ProfilePageProps) {
  const { theme } = useTheme();
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  // Profile data
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    bio: '',
    avatarUrl: null,
    bannerUrl: null,
    accentColor: '#3B82F6',
    gradientStart: '#0066FF',
    gradientEnd: '#00D4FF',
    useGradient: true,
  });
  
  const [tempProfile, setTempProfile] = useState<ProfileData>(profile);

  // Load profile and releases on mount
  useEffect(() => {
    if (user?.wallet?.address) {
      const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        const loadedProfile = {
          name: parsed.name || '',
          bio: parsed.bio || '',
          avatarUrl: parsed.avatarUrl || null,
          bannerUrl: parsed.bannerUrl || null,
          accentColor: parsed.accentColor || '#3B82F6',
          gradientStart: parsed.gradientStart || '#0066FF',
          gradientEnd: parsed.gradientEnd || '#00D4FF',
          useGradient: parsed.useGradient !== false,
        };
        setProfile(loadedProfile);
        setTempProfile(loadedProfile);
      }
      
      setReleases(getReleasesByArtist(user.wallet.address));
    }
  }, [user?.wallet?.address]);

  const handleEditClick = () => {
    setTempProfile(profile);
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfile(tempProfile);
    
    if (user?.wallet?.address) {
      localStorage.setItem(`profile_${user.wallet.address}`, JSON.stringify(tempProfile));
    }
    
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const handleCancel = () => {
    setTempProfile(profile);
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingAvatar(true);
    try {
      const result = await uploadFileToIPFS(file);
      if (result.success && result.url) {
        setTempProfile(prev => ({ ...prev, avatarUrl: result.url! }));
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
    }
    setUploadingAvatar(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingBanner(true);
    try {
      const result = await uploadFileToIPFS(file);
      if (result.success && result.url) {
        setTempProfile(prev => ({ ...prev, bannerUrl: result.url! }));
      }
    } catch (error) {
      console.error('Banner upload failed:', error);
    }
    setUploadingBanner(false);
  };

  const getAccentStyle = (p: ProfileData = profile) => {
    if (p.useGradient) {
      return `linear-gradient(135deg, ${p.gradientStart}, ${p.gradientEnd})`;
    }
    return p.accentColor;
  };

  const tabs = [
    { id: 'posted' as const, label: 'Your Releases', icon: Upload },
    { id: 'owned' as const, label: 'Owned NFTs', icon: Wallet },
    { id: 'sold' as const, label: 'Sold', icon: DollarSign },
  ];

  const getDisplayName = () => {
    if (profile.name) return profile.name;
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
      {/* Banner */}
      <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden">
        {(isEditing ? tempProfile.bannerUrl : profile.bannerUrl) ? (
          <img 
            src={isEditing ? tempProfile.bannerUrl! : profile.bannerUrl!} 
            alt="Banner" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ background: getAccentStyle(isEditing ? tempProfile : profile) }}
          />
        )}
        
        {isEditing && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute bottom-4 right-4 px-4 py-2 bg-black/50 backdrop-blur-sm text-white rounded-xl flex items-center gap-2 hover:bg-black/70 transition-colors"
            >
              {uploadingBanner ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ImageIcon size={18} />
              )}
              {uploadingBanner ? 'Uploading...' : 'Change Banner'}
            </button>
          </>
        )}
      </div>

      {/* Profile Card */}
      <div className={`rounded-2xl border p-6 -mt-20 mx-4 md:mx-6 relative ${
        theme === 'dark'
          ? 'bg-zinc-900/95 backdrop-blur border-zinc-800'
          : 'bg-white/95 backdrop-blur border-zinc-200'
      }`}>
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="relative -mt-16 md:-mt-20">
            <div 
              className="w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-bold text-white overflow-hidden border-4"
              style={{ 
                background: (isEditing ? tempProfile.avatarUrl : profile.avatarUrl) ? 'transparent' : getAccentStyle(isEditing ? tempProfile : profile),
                borderColor: theme === 'dark' ? '#18181b' : '#f4f4f5'
              }}
            >
              {(isEditing ? tempProfile.avatarUrl : profile.avatarUrl) ? (
                <img 
                  src={isEditing ? tempProfile.avatarUrl! : profile.avatarUrl!} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.name?.[0]?.toUpperCase() || user?.wallet?.address?.[0]?.toUpperCase() || 'X'
              )}
            </div>
            
            {isEditing && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  {uploadingAvatar ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                </button>
              </>
            )}
          </div>
          
          <div className="flex-1 w-full">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={tempProfile.name}
                    onChange={(e) => setTempProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your artist name"
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
                    value={tempProfile.bio}
                    onChange={(e) => setTempProfile(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell fans about yourself..."
                    rows={3}
                    className={`w-full mt-1 px-4 py-2 rounded-xl border focus:outline-none focus:border-blue-500 resize-none ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
                  />
                </div>
                
                {/* Color Customization */}
                <div>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}
                  >
                    <Palette size={16} />
                    Customize Colors
                  </button>
                  
                  {showColorPicker && (
                    <div className={`mt-3 p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                      {/* Gradient Toggle */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Use Gradient</span>
                        <button
                          onClick={() => setTempProfile(prev => ({ ...prev, useGradient: !prev.useGradient }))}
                          className={`w-12 h-6 rounded-full transition-colors ${tempProfile.useGradient ? 'bg-blue-500' : theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${tempProfile.useGradient ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      
                      {tempProfile.useGradient ? (
                        <>
                          {/* Preset Gradients */}
                          <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Preset Gradients</p>
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            {PRESET_GRADIENTS.map((gradient) => (
                              <button
                                key={gradient.name}
                                onClick={() => setTempProfile(prev => ({ 
                                  ...prev, 
                                  gradientStart: gradient.start, 
                                  gradientEnd: gradient.end 
                                }))}
                                className={`h-10 rounded-lg transition-transform hover:scale-105 ${
                                  tempProfile.gradientStart === gradient.start && tempProfile.gradientEnd === gradient.end
                                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                                    : ''
                                }`}
                                style={{ background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})` }}
                                title={gradient.name}
                              />
                            ))}
                          </div>
                          
                          {/* Custom Gradient */}
                          <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Custom Gradient</p>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500">Start</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={tempProfile.gradientStart}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientStart: e.target.value }))}
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                />
                                <input
                                  type="text"
                                  value={tempProfile.gradientStart}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientStart: e.target.value }))}
                                  className={`flex-1 px-2 py-1 text-sm rounded-lg border ${
                                    theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                                  }`}
                                />
                              </div>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-zinc-500">End</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={tempProfile.gradientEnd}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientEnd: e.target.value }))}
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                />
                                <input
                                  type="text"
                                  value={tempProfile.gradientEnd}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientEnd: e.target.value }))}
                                  className={`flex-1 px-2 py-1 text-sm rounded-lg border ${
                                    theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Solid Colors */}
                          <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Accent Color</p>
                          <div className="grid grid-cols-6 gap-2 mb-3">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => setTempProfile(prev => ({ ...prev, accentColor: color }))}
                                className={`w-10 h-10 rounded-lg transition-transform hover:scale-105 ${
                                  tempProfile.accentColor === color
                                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                                    : ''
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={tempProfile.accentColor}
                              onChange={(e) => setTempProfile(prev => ({ ...prev, accentColor: e.target.value }))}
                              className="w-10 h-10 rounded-lg cursor-pointer border-0"
                            />
                            <input
                              type="text"
                              value={tempProfile.accentColor}
                              onChange={(e) => setTempProfile(prev => ({ ...prev, accentColor: e.target.value }))}
                              className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                                theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                              }`}
                              placeholder="#3B82F6"
                            />
                          </div>
                        </>
                      )}
                      
                      {/* Preview */}
                      <div className="mt-4 pt-4 border-t border-zinc-700">
                        <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Preview</p>
                        <div 
                          className="h-16 rounded-xl"
                          style={{ background: getAccentStyle(tempProfile) }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Check size={16} />
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                      theme === 'dark'
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                    }`}
                  >
                    <X size={16} />
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
                {profile.bio && (
                  <p className={`mt-3 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {profile.bio}
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

      {/* Tabs */}
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

      {/* Tab Content */}
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
