'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Play, Wallet, Music, ExternalLink, Share2, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import { getReleasesByArtist, Release } from '@/lib/releases-store';

interface ProfileData {
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  pageTheme: 'gradient' | 'solid' | 'image';
  accentColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  backgroundImageUrl: string | null;
  backgroundOpacity: number;
  backgroundBlur: number;
}

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

export default function ArtistPage() {
  const params = useParams();
  const address = params.address as string;
  const { theme } = useTheme();
  
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (address) {
      const savedProfile = localStorage.getItem(`profile_${address}`);
      if (savedProfile) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) });
      }
      setReleases(getReleasesByArtist(address));
      setLoading(false);
    }
  }, [address]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPageBackground = () => {
    if (profile.pageTheme === 'image' && profile.backgroundImageUrl) {
      return 'transparent';
    }
    if (profile.pageTheme === 'gradient') {
      return `linear-gradient(${profile.gradientAngle}deg, ${profile.gradientStart}, ${profile.gradientEnd})`;
    }
    return profile.accentColor;
  };

  const getAccentGradient = () => {
    if (profile.pageTheme === 'gradient') {
      return `linear-gradient(${profile.gradientAngle}deg, ${profile.gradientStart}, ${profile.gradientEnd})`;
    }
    return profile.accentColor;
  };

  const getDisplayName = () => {
    if (profile.name) return profile.name;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {profile.pageTheme === 'image' && profile.backgroundImageUrl ? (
        <div 
          className="fixed inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${profile.backgroundImageUrl})`,
            filter: `blur(${profile.backgroundBlur}px)`,
            opacity: profile.backgroundOpacity / 100,
            transform: 'scale(1.1)',
          }}
        />
      ) : (
        <div 
          className="fixed inset-0"
          style={{ 
            background: getPageBackground(),
            opacity: 0.15,
          }}
        />
      )}
      
      <div className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className={`max-w-6xl mx-auto flex items-center justify-between ${theme === 'dark' ? 'bg-black/50' : 'bg-white/50'} backdrop-blur-xl rounded-2xl px-4 py-3 border ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <Link href="/" className={`flex items-center gap-2 text-sm font-medium ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'}`}>
            <ArrowLeft size={16} />
            Back to XRP Music
          </Link>
          <button
            onClick={copyLink}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${copied ? 'bg-green-500/20 text-green-500' : theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-black'}`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      <div className="relative z-10 pt-20 pb-12">
        <div className="relative h-64 md:h-80">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: getAccentGradient() }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto px-4">
          <div className="relative -mt-24 md:-mt-32">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div 
                className="w-36 h-36 md:w-48 md:h-48 rounded-2xl flex items-center justify-center text-5xl md:text-6xl font-bold text-white overflow-hidden border-4 shadow-2xl flex-shrink-0"
                style={{ 
                  background: profile.avatarUrl ? 'transparent' : getAccentGradient(),
                  borderColor: theme === 'dark' ? '#000000' : '#ffffff'
                }}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile.name?.[0]?.toUpperCase() || address?.[0]?.toUpperCase() || 'X'
                )}
              </div>
              
              <div className="flex-1 pt-4 md:pt-8">
                <h1 className={`text-3xl md:text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {getDisplayName()}
                </h1>
                
                <div className="flex items-center gap-2 mt-2">
                  <Wallet size={14} className="text-zinc-500" />
                  <span className="text-zinc-500 text-sm font-mono">
                    {address.slice(0, 12)}...{address.slice(-8)}
                  </span>
                  <a href={`https://livenet.xrpl.org/accounts/${address}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                    <ExternalLink size={14} />
                  </a>
                </div>
                
                {profile.bio && (
                  <p className={`mt-4 text-lg max-w-2xl ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {profile.bio}
                  </p>
                )}
                
                <div className="flex gap-8 mt-6">
                  <div>
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{releases.length}</p>
                    <p className="text-zinc-500">Releases</p>
                  </div>
                  <div>
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{releases.reduce((sum, r) => sum + r.soldEditions, 0)}</p>
                    <p className="text-zinc-500">Sold</p>
                  </div>
                  <div>
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
                    <p className="text-zinc-500">Followers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-12">
            <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Releases</h2>
            
            {releases.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/50 border-zinc-200'} backdrop-blur-sm`}>
                <Music size={48} className="text-zinc-500 mb-4" />
                <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>No Releases Yet</h3>
                <p className="text-zinc-500 text-center">This artist hasn&apos;t released any music yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {releases.map((release) => {
                  const available = release.totalEditions - release.soldEditions;
                  return (
                    <div key={release.id} className={`rounded-2xl overflow-hidden border group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${theme === 'dark' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'} backdrop-blur-sm`}>
                      <div className="relative">
                        <img src={release.coverUrl} alt={release.title} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <button className="w-14 h-14 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all" style={{ background: getAccentGradient() }}>
                            <Play size={24} fill="white" className="text-white ml-1" />
                          </button>
                        </div>
                        <div className="absolute top-3 left-3 px-2 py-1 text-white text-xs font-bold rounded-full uppercase" style={{ background: getAccentGradient() }}>{release.type}</div>
                        {available < 10 && available > 0 && (
                          <div className="absolute top-3 right-3 px-2 py-1 bg-red-500/90 text-white text-xs font-bold rounded-full">Only {available} left!</div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className={`font-semibold text-lg truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{release.title}</h3>
                        <p className="text-zinc-500 text-sm mb-3">{release.tracks.length} track{release.tracks.length !== 1 ? 's' : ''}</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-zinc-500 text-xs">Price</p>
                            <p className="font-bold" style={{ color: profile.gradientStart || profile.accentColor }}>{release.albumPrice || release.songPrice} XRP</p>
                          </div>
                          <div className="text-right">
                            <p className="text-zinc-500 text-xs">Available</p>
                            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{available}/{release.totalEditions}</p>
                          </div>
                        </div>
                        <button className="w-full mt-4 py-2.5 rounded-xl text-white font-semibold transition-all hover:opacity-90" style={{ background: getAccentGradient() }}>Buy Now</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {releases.length > 0 && (
            <div className="mt-12">
              <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>All Tracks</h2>
              <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/50 border-zinc-200'} backdrop-blur-sm`}>
                {releases.flatMap((release, ri) => 
                  release.tracks.map((track, ti) => (
                    <div key={`${release.id}-${track.id}`} className={`flex items-center gap-4 p-4 transition-colors cursor-pointer group ${theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100/50'} ${ri !== releases.length - 1 || ti !== release.tracks.length - 1 ? (theme === 'dark' ? 'border-b border-zinc-800/50' : 'border-b border-zinc-200/50') : ''}`}>
                      <div className="relative">
                        <img src={release.coverUrl} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
                          <Play size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{track.title}</h4>
                        <p className="text-zinc-500 text-sm truncate">{release.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: profile.gradientStart || profile.accentColor }}>{release.songPrice} XRP</p>
                      </div>
                      <button className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90" style={{ background: getAccentGradient() }}>Buy</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className={`relative z-10 py-8 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Music size={16} className="text-white" />
            </div>
            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>XRP Music</span>
          </Link>
          <p className="text-zinc-500 text-sm">Powered by the XRP Ledger</p>
        </div>
      </div>
    </div>
  );
}
