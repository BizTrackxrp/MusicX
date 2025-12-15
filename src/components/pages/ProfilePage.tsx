'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Wallet, Upload, DollarSign, Music, Camera, Palette, X, Check, Image as ImageIcon, Share2, Copy, ExternalLink } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { getReleasesByArtist, Release } from '@/lib/releases-store';
import { uploadFileToIPFS } from '@/lib/ipfs';

interface ProfilePageProps {
  user: { email?: string; wallet?: { address: string } } | null;
}

export interface ProfileData {
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  // Page wrap customization
  pageTheme: 'gradient' | 'solid' | 'image';
  accentColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  backgroundImageUrl: string | null;
  backgroundOpacity: number;
  backgroundBlur: number;
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
  backgroundImageUrl: null,
  backgroundOpacity: 20,
  backgroundBlur: 20,
};

export function getProfileByAddress(address: string): ProfileData | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(`profile_${address}`);
  if (saved) {
    return { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
  }
  return null;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { theme } = useTheme();
  const [profileTab, setProfileTab] = useState<'posted' | 'owned' | 'sold'>('posted');
  const [isEditing, setIsEditing] = useState(false);
  const [activeCustomization, setActiveCustomization] = useState<'none' | 'colors' | 'background'>('none');
  const [releases, setReleases] = useState<Release[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [tempProfile, setTempProfile] = useState<ProfileData>(DEFAULT_PROFILE);

  useEffect(() => {
    if (user?.wallet?.address) {
      const savedProfile = localStorage.getItem(`profile_${user.wallet.address}`);
      if (savedProfile) {
        const loadedProfile = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) };
        setProfile(loadedProfile);
        setTempProfile(loadedProfile);
      }
      setReleases(getReleasesByArtist(user.wallet.address));
    }
  }, [user?.wallet?.address]);

  const handleSave = () => {
    setProfile(tempProfile);
    if (user?.wallet?.address) {
      localStorage.setItem(`profile_${user.wallet.address}`, JSON.stringify(tempProfile));
    }
    setIsEditing(false);
    setActiveCustomization('none');
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

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBackground(true);
    try {
      const result = await uploadFileToIPFS(file);
      if (result.success && result.url) {
        setTempProfile(prev => ({ ...prev, backgroundImageUrl: result.url!, pageTheme: 'image' }));
      }
    } catch (error) {
      console.error('Background upload failed:', error);
    }
    setUploadingBackground(false);
  };

  const copyProfileLink = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(`https://xrpmusic.io/artist/${user.wallet.address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPageBackground = (p: ProfileData = profile) => {
    if (p.pageTheme === 'image' && p.backgroundImageUrl) {
      return 'transparent';
    }
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

  const currentProfile = isEditing ? tempProfile : profile;

  return (
    <div className="relative min-h-screen -m-4 lg:-m-6 -mb-32">
      {/* Page Background Wrap */}
      {currentProfile.pageTheme === 'image' && currentProfile.backgroundImageUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ 
            backgroundImage: `url(${currentProfile.backgroundImageUrl})`,
            filter: `blur(${currentProfile.backgroundBlur}px)`,
            opacity: currentProfile.backgroundOpacity / 100,
            transform: 'scale(1.1)',
          }}
        />
      ) : (
        <div 
          className="absolute inset-0"
          style={{ 
            background: getPageBackground(currentProfile),
            opacity: 0.15,
          }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10 p-4 lg:p-6 pb-32 space-y-6">
        
        {/* Share Link Banner */}
        {profile.name && !isEditing && (
          <div className={`flex items-center justify-between p-3 rounded-xl ${
            theme === 'dark' ? 'bg-zinc-900/80 border border-zinc-800' : 'bg-white/80 border border-zinc-200'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <Share2 size={16} className="text-blue-500" />
              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>
                Your artist page:
              </span>
              <span className="text-blue-500 font-medium">
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
              style={{ 
                background: currentProfile.pageTheme === 'gradient' 
                  ? `linear-gradient(${currentProfile.gradientAngle}deg, ${currentProfile.gradientStart}, ${currentProfile.gradientEnd})`
                  : currentProfile.accentColor
              }}
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
        <div className={`rounded-2xl border p-6 -mt-20 mx-2 md:mx-4 relative z-10 ${
          theme === 'dark'
            ? 'bg-zinc-900/95 backdrop-blur-xl border-zinc-800'
            : 'bg-white/95 backdrop-blur-xl border-zinc-200'
        }`}>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative -mt-16 md:-mt-20 flex-shrink-0">
              <div 
                className="w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-bold text-white overflow-hidden border-4 shadow-xl"
                style={{ 
                  background: currentProfile.avatarUrl ? 'transparent' : (
                    currentProfile.pageTheme === 'gradient'
                      ? `linear-gradient(${currentProfile.gradientAngle}deg, ${currentProfile.gradientStart}, ${currentProfile.gradientEnd})`
                      : currentProfile.accentColor
                  ),
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
                    className="absolute bottom-2 right-2 p-2.5 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition-colors border border-white/20"
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
                  
                  {/* Customization Buttons */}
                  <div className="flex flex-wrap gap-2">
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
                    <button
                      onClick={() => setActiveCustomization(activeCustomization === 'background' ? 'none' : 'background')}
                      className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${
                        activeCustomization === 'background'
                          ? 'bg-blue-500 text-white'
                          : theme === 'dark'
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                      }`}
                    >
                      <ImageIcon size={16} />
                      Background Image
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
                                className={`h-12 rounded-lg transition-all hover:scale-105 ${
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
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                                />
                                <input
                                  type="text"
                                  value={tempProfile.gradientStart}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientStart: e.target.value }))}
                                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
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
                                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                                />
                                <input
                                  type="text"
                                  value={tempProfile.gradientEnd}
                                  onChange={(e) => setTempProfile(prev => ({ ...prev, gradientEnd: e.target.value }))}
                                  className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
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
                    </div>
                  )}
                  
                  {/* Background Image Panel */}
                  {activeCustomization === 'background' && (
                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                      <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        🖼️ Background Image Wrap
                      </h4>
                      <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        Upload an image to wrap your entire page. We'll add a subtle blur effect to keep your content readable.
                      </p>
                      
                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      
                      {tempProfile.backgroundImageUrl ? (
                        <div className="space-y-4">
                          <div className="relative aspect-video rounded-xl overflow-hidden">
                            <img 
                              src={tempProfile.backgroundImageUrl} 
                              alt="Background" 
                              className="w-full h-full object-cover"
                              style={{
                                filter: `blur(${tempProfile.backgroundBlur}px)`,
                                opacity: tempProfile.backgroundOpacity / 100,
                              }}
                            />
                            <button
                              onClick={() => backgroundInputRef.current?.click()}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <span className="text-white font-medium">Change Image</span>
                            </button>
                          </div>
                          
                          <div>
                            <label className="text-xs text-zinc-500">Blur: {tempProfile.backgroundBlur}px</label>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={tempProfile.backgroundBlur}
                              onChange={(e) => setTempProfile(prev => ({ ...prev, backgroundBlur: Number(e.target.value) }))}
                              className="w-full mt-1"
                            />
                          </div>
                          
                          <div>
                            <label className="text-xs text-zinc-500">Opacity: {tempProfile.backgroundOpacity}%</label>
                            <input
                              type="range"
                              min="5"
                              max="50"
                              value={tempProfile.backgroundOpacity}
                              onChange={(e) => setTempProfile(prev => ({ ...prev, backgroundOpacity: Number(e.target.value) }))}
                              className="w-full mt-1"
                            />
                          </div>
                          
                          <button
                            onClick={() => setTempProfile(prev => ({ ...prev, backgroundImageUrl: null, pageTheme: 'gradient' }))}
                            className="text-red-500 text-sm hover:underline"
                          >
                            Remove background image
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => backgroundInputRef.current?.click()}
                          disabled={uploadingBackground}
                          className={`w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors ${
                            theme === 'dark'
                              ? 'border-zinc-700 hover:border-blue-500/50'
                              : 'border-zinc-300 hover:border-blue-500/50'
                          }`}
                        >
                          {uploadingBackground ? (
                            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                          ) : (
                            <>
                              <ImageIcon size={32} className="text-zinc-500" />
                              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>
                                Upload background image
                              </span>
                              <span className="text-xs text-zinc-500">
                                Recommended: 1920x1080 or larger
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Save/Cancel */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={!tempProfile.name}
                      className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Check size={16} />
                      Save Profile
                    </button>
                    <button
                      onClick={handleCancel}
                      className={`px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${
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
                  <h2 className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    {getDisplayName()}
                  </h2>
                  <p className="text-zinc-500 mt-1 flex items-center gap-2">
                    <Wallet size={14} />
                    {user.wallet.address.slice(0, 12)}...{user.wallet.address.slice(-8)}
                  </p>
                  {profile.bio && (
                    <p className={`mt-3 max-w-2xl ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {profile.bio}
                    </p>
                  )}
                  <div className="flex gap-8 mt-6">
                    <div>
                      <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                        {releases.length}
                      </p>
                      <p className="text-zinc-500 text-sm">Releases</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
                      <p className="text-zinc-500 text-sm">Collectors</p>
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
                onClick={() => setIsEditing(true)}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors flex-shrink-0 ${
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
              <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${
                theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
              }`}>
                <Music size={48} className="text-zinc-500 mb-4" />
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  No Releases Yet
                </h3>
                <p className="text-zinc-500 text-center mb-4">
                  Start minting your music to build your catalog!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {releases.map((release) => {
                  const available = release.totalEditions - release.soldEditions;
                  return (
                    <div key={release.id} className={`rounded-2xl overflow-hidden border group transition-all hover:scale-[1.02] ${
                      theme === 'dark' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-zinc-200'
                    }`}>
                      <div className="relative">
                        <img src={release.coverUrl} alt={release.title} className="w-full aspect-square object-cover" />
                        <div 
                          className="absolute top-3 left-3 px-2 py-1 text-white text-xs font-bold rounded-full uppercase"
                          style={{ background: getPageBackground() }}
                        >
                          {release.type}
                        </div>
                        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                          {available} left
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                          {release.title}
                        </h3>
                        <p className="text-zinc-500 text-sm mb-3">{release.tracks.length} track{release.tracks.length !== 1 ? 's' : ''}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-500 font-bold">{release.albumPrice || release.songPrice} XRP</span>
                          <span className="text-zinc-500 text-sm">{release.soldEditions} sold</span>
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
          <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <Wallet size={48} className="text-zinc-500 mb-4" />
            <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Your Collection
            </h3>
            <p className="text-zinc-500 text-center">
              NFTs you've purchased will appear here
            </p>
          </div>
        )}

        {profileTab === 'sold' && (
          <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <DollarSign size={48} className="text-zinc-500 mb-4" />
            <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Sales History
            </h3>
            <p className="text-zinc-500 text-center">
              Your sales and earnings will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
