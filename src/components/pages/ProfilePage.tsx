'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Wallet, Upload, DollarSign, Music, Camera, Palette, X, Check, Image as ImageIcon, Share2, Copy, ExternalLink, Loader2, Play } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { uploadFileToIPFS } from '@/lib/ipfs';
import AlbumModal from '@/components/modals/AlbumModal';
import { Track } from '@/types';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
  onPlayTrack?: (track: Track & { artist?: string; cover?: string }) => void;
  currentlyPlayingId?: number | null;
}

export interface ProfileData {
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  pageTheme: 'gradient' | 'solid';
  accentColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
}

interface Release {
  id: string;
  type: string;
  title: string;
  description?: string;
  artistName: string;
  artistAddress: string;
  coverUrl: string;
  songPrice: number;
  albumPrice?: number;
  totalEditions: number;
  soldEditions: number;
  createdAt?: string;
  tracks: Array<{
    id: string;
    title: string;
    audioUrl: string;
    audioCid: string;
    duration?: number;
  }>;
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
  { name: 'Rose', start: '#F43B47', end: '#453A94' },
  { name: 'Aqua', start: '#00C9FF', end: '#92FE9D' },
  { name: 'Noir', start: '#000000', end: '#434343' },
  { name: 'Candy', start: '#D585FF', end: '#00FFEE' },
];

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', 
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#6366F1', '#A855F7', '#F43F5E',
];

const DEFAULT_PROFILE: ProfileData = {
  name: '',
  bio: '',
  avatarUrl: null,
  bannerUrl: null,
  pageTheme: 'gradient',
  accentColor: '#3B82F6',
  gradientStart: '#0066FF',
  gradientEnd: '#00D4FF',
  gradientAngle: 135,
};

export default function ProfilePage({ user, onPlayTrack, currentlyPlayingId }: ProfilePageProps) {
  const { theme } = useTheme();
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');
  const [isEditing, setIsEditing] = useState(false);
  const [activeCustomization, setActiveCustomization] = useState<'none' | 'colors'>('none');
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [tempProfile, setTempProfile] = useState<ProfileData>(DEFAULT_PROFILE);

  // Load profile and releases from API
  useEffect(() => {
    async function loadData() {
      if (!user?.wallet?.address) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        // Load profile from API
        const profileRes = await fetch(`/api/profile?address=${user.wallet.address}`);
        const profileData = await profileRes.json();
        
        if (profileData.success && profileData.profile) {
          const loadedProfile = {
            name: profileData.profile.name || '',
            bio: profileData.profile.bio || '',
            avatarUrl: profileData.profile.avatarUrl || null,
            bannerUrl: profileData.profile.bannerUrl || null,
            pageTheme: profileData.profile.pageTheme || 'gradient',
            accentColor: profileData.profile.accentColor || '#3B82F6',
            gradientStart: profileData.profile.gradientStart || '#0066FF',
            gradientEnd: profileData.profile.gradientEnd || '#00D4FF',
            gradientAngle: profileData.profile.gradientAngle || 135,
          };
          setProfile(loadedProfile);
          setTempProfile(loadedProfile);
        } else {
          // Fallback to localStorage for migration
          const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            const loadedProfile = { ...DEFAULT_PROFILE, ...parsed };
            setProfile(loadedProfile);
            setTempProfile(loadedProfile);
          }
        }

        // Load releases from API
        const releasesRes = await fetch(`/api/releases?artist=${user.wallet.address}`);
        const releasesData = await releasesRes.json();
        
        if (releasesData.success && releasesData.releases) {
          setReleases(releasesData.releases);
        }
      } catch (error) {
        console.error('Failed to load profile data:', error);
        // Fallback to localStorage
        const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          const loadedProfile = { ...DEFAULT_PROFILE, ...parsed };
          setProfile(loadedProfile);
          setTempProfile(loadedProfile);
        }
      }
      
      setLoading(false);
    }

    loadData();
  }, [user?.wallet?.address]);

  const handleSave = async () => {
    if (!user?.wallet?.address) return;
    
    setSaving(true);
    
    try {
      // Save to API
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: user.wallet.address,
          name: tempProfile.name,
          bio: tempProfile.bio,
          avatarUrl: tempProfile.avatarUrl,
          bannerUrl: tempProfile.bannerUrl,
          pageTheme: tempProfile.pageTheme,
          accentColor: tempProfile.accentColor,
          gradientStart: tempProfile.gradientStart,
          gradientEnd: tempProfile.gradientEnd,
          gradientAngle: tempProfile.gradientAngle,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save profile');
      }

      // Also save to localStorage as backup
      localStorage.setItem(`profile_${user.wallet.address}`, JSON.stringify(tempProfile));
      
      setProfile(tempProfile);
      setIsEditing(false);
      setActiveCustomization('none');
      
      // Dispatch event for sidebar to update
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Still save to localStorage as fallback
      localStorage.setItem(`profile_${user.wallet.address}`, JSON.stringify(tempProfile));
      setProfile(tempProfile);
      setIsEditing(false);
      setActiveCustomization('none');
    }
    
    setSaving(false);
  };

  const handleCancel = () => {
    setTempProfile(profile);
    setIsEditing(false);
    setActiveCustomization('none');
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

  const copyProfileLink = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(`https://xrpmusic.io/artist/${user.wallet.address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getAccentGradient = (p: ProfileData = profile) => {
    if (p.pageTheme === 'gradient') {
      return `linear-gradient(${p.gradientAngle}deg, ${p.gradientStart}, ${p.gradientEnd})`;
    }
    return p.accentColor;
  };

  const tabs = [
    { id: 'posted' as const, label: 'Releases', icon: Upload },
    { id: 'owned' as const, label: 'Collection', icon: Wallet },
    { id: 'sold' as const, label: 'Sales', icon: DollarSign },
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-500">Loading profile...</p>
      </div>
    );
  }

  const currentProfile = isEditing ? tempProfile : profile;

  return (
    <div className="space-y-6">
      {/* Album Modal */}
      <AlbumModal
        isOpen={selectedRelease !== null}
        onClose={() => setSelectedRelease(null)}
        release={selectedRelease}
        onPlay={onPlayTrack || (() => {})}
        currentlyPlayingId={currentlyPlayingId}
      />

      {/* Share Link Banner */}
      {profile.name && !isEditing && (
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl ${
          theme === 'dark' ? 'bg-zinc-900/80 border border-zinc-800' : 'bg-white/80 border border-zinc-200'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <Share2 size={16} className="text-blue-500" />
            <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>
              Your artist page:
            </span>
            <span className="text-blue-500 font-medium truncate">
              xrpmusic.io/artist/{user.wallet.address.slice(0, 8)}...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyProfileLink}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                copied 
                  ? 'bg-green-500/20 text-green-500' 
                  : theme === 'dark' 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                    : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={`/artist/${user.wallet.address}`}
              target="_blank"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                theme === 'dark' 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
            >
              <ExternalLink size={14} />
              Preview
            </a>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden">
        {currentProfile.bannerUrl ? (
          <img 
            src={currentProfile.bannerUrl} 
            alt="Banner" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ background: getAccentGradient(currentProfile) }}
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
              className="absolute bottom-4 right-4 z-20 px-4 py-2 bg-black/60 backdrop-blur-sm text-white rounded-xl flex items-center gap-2 hover:bg-black/80 transition-colors border border-white/20"
            >
              {uploadingBanner ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ImageIcon size={18} />
              )}
              {uploadingBanner ? 'Uploading...' : 'Change Banner'}
            </button>
          </>
        )}
      </div>

      {/* Profile Card */}
      <div className={`rounded-2xl border p-4 sm:p-6 -mt-20 mx-2 md:mx-4 relative z-10 ${
        theme === 'dark'
          ? 'bg-zinc-900/95 backdrop-blur-xl border-zinc-800'
          : 'bg-white/95 backdrop-blur-xl border-zinc-200'
      }`}>
        <div className="flex flex-col md:flex-row items-start gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="relative -mt-16 md:-mt-20 flex-shrink-0">
            <div 
              className="w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl md:text-5xl font-bold text-white overflow-hidden border-4 shadow-xl"
              style={{ 
                background: currentProfile.avatarUrl ? 'transparent' : getAccentGradient(currentProfile),
                borderColor: theme === 'dark' ? '#18181b' : '#ffffff'
              }}
            >
              {currentProfile.avatarUrl ? (
                <img src={currentProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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
                  className="absolute bottom-2 right-2 p-2 sm:p-2.5 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition-colors border border-white/20"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                </button>
              </>
            )}
          </div>
          
          {/* Profile Info */}
          <div className="flex-1 w-full">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Artist Name *
                  </label>
                  <input
                    type="text"
                    value={tempProfile.name}
                    onChange={(e) => setTempProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your artist name"
                    className={`w-full mt-1 px-4 py-3 rounded-xl border focus:outline-none focus:border-blue-500 ${
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
                    placeholder="Tell fans about yourself and your music..."
                    rows={3}
                    className={`w-full mt-1 px-4 py-3 rounded-xl border focus:outline-none focus:border-blue-500 resize-none ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
                    }`}
                  />
                </div>
                
                {/* Color Customization Button */}
                <div>
                  <button
                    onClick={() => setActiveCustomization(activeCustomization === 'colors' ? 'none' : 'colors')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${
                      activeCustomization === 'colors'
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark'
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                    }`}
                  >
                    <Palette size={16} />
                    Page Theme
                  </button>
                </div>
                
                {/* Color Theme Panel */}
                {activeCustomization === 'colors' && (
                  <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                    <h4 className={`font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      🎨 Customize Your Page Theme
                    </h4>
                    
                    {/* Theme Type Toggle */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setTempProfile(prev => ({ ...prev, pageTheme: 'gradient' }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tempProfile.pageTheme === 'gradient'
                            ? 'bg-blue-500 text-white'
                            : theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        Gradient
                      </button>
                      <button
                        onClick={() => setTempProfile(prev => ({ ...prev, pageTheme: 'solid' }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          tempProfile.pageTheme === 'solid'
                            ? 'bg-blue-500 text-white'
                            : theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        Solid Color
                      </button>
                    </div>
                    
                    {tempProfile.pageTheme === 'gradient' ? (
                      <>
                        <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Choose a preset or create your own
                        </p>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mb-4">
                          {PRESET_GRADIENTS.map((gradient) => (
                            <button
                              key={gradient.name}
                              onClick={() => setTempProfile(prev => ({ 
                                ...prev, 
                                gradientStart: gradient.start, 
                                gradientEnd: gradient.end 
                              }))}
                              className={`h-10 sm:h-12 rounded-lg transition-all hover:scale-105 ${
                                tempProfile.gradientStart === gradient.start && tempProfile.gradientEnd === gradient.end
                                  ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900 scale-105'
                                  : ''
                              }`}
                              style={{ background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})` }}
                              title={gradient.name}
                            />
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-zinc-500">Start Color</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={tempProfile.gradientStart}
                                onChange={(e) => setTempProfile(prev => ({ ...prev, gradientStart: e.target.value }))}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                              />
                              <input
                                type="text"
                                value={tempProfile.gradientStart}
                                onChange={(e) => setTempProfile(prev => ({ ...prev, gradientStart: e.target.value }))}
                                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg border ${
                                  theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                                }`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-zinc-500">End Color</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={tempProfile.gradientEnd}
                                onChange={(e) => setTempProfile(prev => ({ ...prev, gradientEnd: e.target.value }))}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                              />
                              <input
                                type="text"
                                value={tempProfile.gradientEnd}
                                onChange={(e) => setTempProfile(prev => ({ ...prev, gradientEnd: e.target.value }))}
                                className={`flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg border ${
                                  theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <label className="text-xs text-zinc-500">Gradient Angle: {tempProfile.gradientAngle}°</label>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={tempProfile.gradientAngle}
                            onChange={(e) => setTempProfile(prev => ({ ...prev, gradientAngle: Number(e.target.value) }))}
                            className="w-full mt-1"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Choose your accent color
                        </p>
                        <div className="grid grid-cols-6 gap-2 mb-4">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setTempProfile(prev => ({ ...prev, accentColor: color }))}
                              className={`w-full aspect-square rounded-lg transition-all hover:scale-105 ${
                                tempProfile.accentColor === color
                                  ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900 scale-105'
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
                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={tempProfile.accentColor}
                            onChange={(e) => setTempProfile(prev => ({ ...prev, accentColor: e.target.value }))}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                              theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                            }`}
                          />
                        </div>
                      </>
                    )}
                    
                    {/* Preview */}
                    <div className="mt-4 pt-4 border-t border-zinc-700">
                      <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Preview</p>
                      <div 
                        className="h-16 rounded-xl"
                        style={{ background: getAccentGradient(tempProfile) }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Save/Cancel */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!tempProfile.name || saving}
                    className="px-4 sm:px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Save Profile
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className={`px-4 sm:px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${
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
                <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {getDisplayName()}
                </h2>
                <p className="text-zinc-500 mt-1 flex items-center gap-2 text-sm">
                  <Wallet size={14} />
                  <span className="truncate">{user.wallet.address.slice(0, 12)}...{user.wallet.address.slice(-8)}</span>
                </p>
                {profile.bio && (
                  <p className={`mt-3 max-w-2xl text-sm sm:text-base ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {profile.bio}
                  </p>
                )}
                <div className="flex gap-6 sm:gap-8 mt-4 sm:mt-6">
                  <div>
                    <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      {releases.length}
                    </p>
                    <p className="text-zinc-500 text-xs sm:text-sm">Releases</p>
                  </div>
                  <div>
                    <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
                    <p className="text-zinc-500 text-xs sm:text-sm">Collectors</p>
                  </div>
                  <div>
                    <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
                    <p className="text-zinc-500 text-xs sm:text-sm">Followers</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className={`px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 transition-colors flex-shrink-0 text-sm ${
                theme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 sm:gap-2 border-b pb-1 overflow-x-auto ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProfileTab(tab.id)}
            className={`px-3 sm:px-5 py-2 sm:py-3 rounded-t-xl flex items-center gap-1 sm:gap-2 font-medium transition-colors whitespace-nowrap text-sm ${
              profileTab === tab.id
                ? theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-black'
                : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'
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
            <div className={`flex flex-col items-center justify-center py-12 sm:py-16 rounded-2xl border ${
              theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
            }`}>
              <Music size={48} className="text-zinc-500 mb-4" />
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                No Releases Yet
              </h3>
              <p className="text-zinc-500 text-center mb-4 px-4">
                Start minting your music to build your catalog!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {releases.map((release) => {
                const available = release.totalEditions - release.soldEditions;
                return (
                  <div 
                    key={release.id} 
                    className={`rounded-xl sm:rounded-2xl overflow-hidden border group transition-all hover:scale-[1.02] cursor-pointer ${
                      theme === 'dark' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-zinc-200'
                    }`}
                    onClick={() => setSelectedRelease(release)}
                  >
                    <div className="relative">
                      <img src={release.coverUrl} alt={release.title} className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Play first track
                            if (onPlayTrack && release.tracks.length > 0) {
                              const track = release.tracks[0];
                              onPlayTrack({
                                id: parseInt(track.id) || 0,
                                title: release.type === 'single' ? release.title : track.title,
                                duration: track.duration?.toString() || '0:00',
                                price: release.songPrice,
                                available: available,
                                plays: 0,
                                mediaType: 'audio',
                                ipfsHash: track.audioCid,
                                artist: release.artistName || release.artistAddress.slice(0, 8) + '...',
                                cover: release.coverUrl,
                              });
                            }
                          }}
                        >
                          <Play size={20} fill="white" className="text-white ml-0.5" />
                        </button>
                      </div>
                      <div 
                        className="absolute top-2 left-2 px-2 py-0.5 text-white text-xs font-bold rounded-full uppercase"
                        style={{ background: getAccentGradient() }}
                      >
                        {release.type}
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                        {available} left
                      </div>
                    </div>
                    <div className="p-3 sm:p-4">
                      <h3 className={`font-semibold truncate text-sm sm:text-base ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {release.title}
                      </h3>
                      <p className="text-zinc-500 text-xs sm:text-sm mb-2 sm:mb-3">
                        {release.tracks.length} track{release.tracks.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-500 font-bold text-sm">{release.albumPrice || release.songPrice} XRP</span>
                        <span className="text-zinc-500 text-xs">{release.soldEditions} sold</span>
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
        <div className={`flex flex-col items-center justify-center py-12 sm:py-16 rounded-2xl border ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <Wallet size={48} className="text-zinc-500 mb-4" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Your Collection
          </h3>
          <p className="text-zinc-500 text-center px-4">
            NFTs you&apos;ve purchased will appear here
          </p>
        </div>
      )}

      {profileTab === 'sold' && (
        <div className={`flex flex-col items-center justify-center py-12 sm:py-16 rounded-2xl border ${
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <DollarSign size={48} className="text-zinc-500 mb-4" />
          <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            Sales History
          </h3>
          <p className="text-zinc-500 text-center px-4">
            Your sales and earnings will appear here
          </p>
        </div>
      )}
    </div>
  );
}

