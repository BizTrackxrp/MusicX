'use client';

import { useState, useRef } from 'react';
import { X, Music, Disc, Upload, Plus, Check, TrendingUp, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TrackFile {
  id: string;
  file: File;
  title: string;
}

export default function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [releaseType, setReleaseType] = useState<'single' | 'album'>('single');
  
  // Album/Release info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverArt, setCoverArt] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  // Tracks
  const [tracks, setTracks] = useState<TrackFile[]>([]);
  
  // Pricing - ONE price for all
  const [quantity, setQuantity] = useState(100);
  const [songPrice, setSongPrice] = useState(5);
  const [albumPrice, setAlbumPrice] = useState(25);
  
  const [minting, setMinting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverArt(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleTracksUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTracks = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for title
    }));
    setTracks([...tracks, ...newTracks]);
  };

  const updateTrackTitle = (id: string, newTitle: string) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, title: newTitle } : t));
  };

  const removeTrack = (id: string) => {
    setTracks(tracks.filter(t => t.id !== id));
  };

  const handleMint = () => {
    setMinting(true);
    // TODO: Actually mint to XRPL
    setTimeout(() => {
      setMinting(false);
      onClose();
      // Reset form
      setStep(1);
      setTitle('');
      setDescription('');
      setCoverArt(null);
      setCoverPreview(null);
      setTracks([]);
      setQuantity(100);
      setSongPrice(5);
      setAlbumPrice(25);
    }, 3000);
  };

  const totalSteps = 3;
  
  const inputClass = `w-full px-4 py-3 border rounded-xl transition-colors focus:outline-none focus:border-blue-500 ${
    theme === 'dark'
      ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
      : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
  }`;

  const canContinue = () => {
    if (step === 1) return true;
    if (step === 2) return title && tracks.length > 0;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 animate-slide-up ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-gradient-to-br from-blue-500/5 to-transparent' : ''}`} />

        {/* Header */}
        <div className={`relative p-6 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Create & Mint to XRPL
            </h2>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${
                step >= i + 1 ? 'bg-blue-500' : theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
              }`} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>Type</span>
            <span>Upload</span>
            <span>Pricing</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          
          {/* Step 1: Release Type */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm text-zinc-500 mb-3">What are you releasing?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReleaseType('single')}
                    className={`flex-1 p-6 rounded-xl border transition-all flex flex-col items-center gap-3 ${
                      releaseType === 'single'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                        : theme === 'dark'
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <Music size={32} />
                    <div className="text-center">
                      <p className="font-semibold">Single Track</p>
                      <p className={`text-xs mt-1 ${releaseType === 'single' ? 'text-blue-400' : 'text-zinc-500'}`}>
                        One song, one NFT collection
                      </p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setReleaseType('album')}
                    className={`flex-1 p-6 rounded-xl border transition-all flex flex-col items-center gap-3 ${
                      releaseType === 'album'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                        : theme === 'dark'
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <Disc size={32} />
                    <div className="text-center">
                      <p className="font-semibold">Album / EP</p>
                      <p className={`text-xs mt-1 ${releaseType === 'album' ? 'text-blue-400' : 'text-zinc-500'}`}>
                        Multiple tracks, shared inventory
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {releaseType === 'album' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <TrendingUp size={20} className="text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="text-amber-500 font-semibold text-sm">Shared Inventory Pool</h4>
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        If you mint 100 editions: selling 1 album OR 1 individual track both reduce from the same pool. 
                        Fans can buy the full album or pick individual songs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Upload Files */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {/* Cover Art */}
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">Cover Art</label>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className={`aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center overflow-hidden ${
                      theme === 'dark' 
                        ? 'border-zinc-700 hover:border-blue-500/50' 
                        : 'border-zinc-300 hover:border-blue-500/50'
                    }`}
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon size={24} className="text-zinc-500 mb-2" />
                        <p className="text-zinc-500 text-xs">Upload</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="col-span-2 space-y-3">
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">
                      {releaseType === 'album' ? 'Album Title' : 'Track Title'}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={releaseType === 'album' ? 'My Awesome Album' : 'My Awesome Track'}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell fans about this release..."
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
              </div>

              {/* Track Upload */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-zinc-500">
                    {releaseType === 'album' ? 'Album Tracks' : 'Audio File'}
                  </label>
                  {tracks.length > 0 && (
                    <span className="text-xs text-blue-500">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple={releaseType === 'album'}
                  onChange={handleTracksUpload}
                  className="hidden"
                />

                {tracks.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer group transition-colors ${
                      theme === 'dark' 
                        ? 'border-zinc-700 hover:border-blue-500/50' 
                        : 'border-zinc-300 hover:border-blue-500/50'
                    }`}
                  >
                    <Upload size={32} className="mx-auto text-zinc-500 group-hover:text-blue-500 mb-2" />
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      Drop your {releaseType === 'album' ? 'tracks' : 'track'} here
                    </p>
                    <p className="text-zinc-500 text-sm">MP3, WAV, or FLAC</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-100'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          theme === 'dark' ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                        }`}>
                          {index + 1}
                        </span>
                        <Music size={16} className="text-blue-500" />
                        <input
                          type="text"
                          value={track.title}
                          onChange={(e) => updateTrackTitle(track.id, e.target.value)}
                          className={`flex-1 bg-transparent border-none focus:outline-none ${
                            theme === 'dark' ? 'text-white' : 'text-black'
                          }`}
                        />
                        <span className="text-xs text-zinc-500">
                          {(track.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button 
                          onClick={() => removeTrack(track.id)}
                          className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    
                    {releaseType === 'album' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
                          theme === 'dark' 
                            ? 'border-zinc-700 hover:border-blue-500/50 text-zinc-500' 
                            : 'border-zinc-300 hover:border-blue-500/50 text-zinc-500'
                        }`}
                      >
                        <Plus size={16} />
                        Add more tracks
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">Edition Size (Total Copies)</label>
                <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  How many copies of {releaseType === 'album' ? 'each track' : 'this track'} will exist?
                </p>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="1000" 
                    value={quantity} 
                    onChange={(e) => setQuantity(Number(e.target.value))} 
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className={`w-24 px-3 py-2 text-center rounded-lg border transition-colors focus:outline-none focus:border-blue-500 ${
                      theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-500 mb-2">
                  Price per Song (XRP)
                </label>
                <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {releaseType === 'album' 
                    ? 'This price applies to ALL tracks in the album when bought individually.'
                    : 'Price to buy this track.'
                  }
                </p>
                <div className="relative">
                  <input 
                    type="number" 
                    value={songPrice} 
                    onChange={(e) => setSongPrice(Number(e.target.value))} 
                    className={`${inputClass} pr-16`} 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                </div>
              </div>

              {releaseType === 'album' && (
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">Album Bundle Price (XRP)</label>
                  <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Discounted price when fans buy all {tracks.length} tracks together.
                  </p>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={albumPrice} 
                      onChange={(e) => setAlbumPrice(Number(e.target.value))} 
                      className={`${inputClass} pr-16`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                  </div>
                  <p className="text-xs text-blue-500 mt-2">
                    💡 Individual tracks: {tracks.length} × {songPrice} XRP = {tracks.length * songPrice} XRP | 
                    Album bundle saves {tracks.length * songPrice - albumPrice} XRP
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Release</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{title || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Tracks</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{tracks.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Editions</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{quantity} copies each</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Song Price</span>
                    <span className="text-blue-500 font-medium">{songPrice} XRP</span>
                  </div>
                  {releaseType === 'album' && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Album Price</span>
                      <span className="text-blue-500 font-medium">{albumPrice} XRP</span>
                    </div>
                  )}
                </div>
                <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-zinc-700' : 'border-zinc-300'}`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Platform Fee</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-black'}>2%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">You Receive</span>
                    <span className="text-green-500 font-medium">98% of each sale</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`relative p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)} 
              className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                theme === 'dark' 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-black'
              }`}
            >
              Back
            </button>
          )}
          
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canContinue()}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={minting}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {minting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Minting to XRPL...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Mint & List for Sale
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
