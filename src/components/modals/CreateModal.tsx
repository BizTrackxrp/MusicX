'use client';

import { useState } from 'react';
import { X, Music, Video, Disc, Upload, Plus, DollarSign, Check, TrendingUp, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TrackInput {
  id: number;
  title: string;
  price: number;
  file: File | null;
}

export default function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [releaseType, setReleaseType] = useState<'single' | 'album'>('single');
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [price, setPrice] = useState(25);
  const [albumPrice, setAlbumPrice] = useState(0);
  const [tracks, setTracks] = useState<TrackInput[]>([{ id: 1, title: '', price: 25, file: null }]);
  const [minting, setMinting] = useState(false);

  if (!isOpen) return null;

  const addTrack = () => {
    setTracks([...tracks, { id: tracks.length + 1, title: '', price: 25, file: null }]);
  };

  const updateTrack = (id: number, field: keyof TrackInput, value: string | number | File | null) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTrack = (id: number) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter(t => t.id !== id));
    }
  };

  const totalTrackPrice = tracks.reduce((sum, t) => sum + (t.price || 0), 0);
  const suggestedAlbumPrice = Math.round(totalTrackPrice * 0.8);

  const handleMint = () => {
    setMinting(true);
    setTimeout(() => {
      setMinting(false);
      onClose();
      setStep(1);
      setTitle('');
      setDescription('');
      setQuantity(100);
      setPrice(25);
      setTracks([{ id: 1, title: '', price: 25, file: null }]);
    }, 3000);
  };

  const totalSteps = releaseType === 'album' ? 4 : 3;
  const inputClass = `w-full px-4 py-3 border rounded-xl transition-colors focus:outline-none focus:border-blue-500 ${
    theme === 'dark'
      ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
      : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-400'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 animate-slide-up ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800'
          : 'bg-white border-zinc-200'
      }`}>
        <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-gradient-to-br from-blue-500/5 to-transparent' : ''}`} />

        <div className={`relative p-6 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Create & Mint to XRPL</h2>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${step >= i + 1 ? 'bg-blue-500' : theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
            ))}
          </div>
        </div>

        <div className="relative p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">Release Type</label>
                <div className="flex gap-3">
                  {['single', 'album'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setReleaseType(type as 'single' | 'album')}
                      className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                        releaseType === type
                          ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                          : theme === 'dark'
                            ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {type === 'single' ? <Music size={24} /> : <Disc size={24} />}
                      <span className="text-sm font-medium capitalize">{type === 'single' ? 'Single Track' : 'Album / EP'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-500 mb-2">Media Type</label>
                <div className="flex gap-3">
                  {['audio', 'video'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setMediaType(type as 'audio' | 'video')}
                      className={`flex-1 p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                        mediaType === type
                          ? 'bg-purple-500/10 border-purple-500 text-purple-500'
                          : theme === 'dark'
                            ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {type === 'audio' ? <Music size={18} /> : <Video size={18} />}
                      <span className="text-sm font-medium">{type === 'audio' ? 'Audio (MP3)' : 'Video (MP4)'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {releaseType === 'album' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <TrendingUp size={20} className="text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="text-amber-500 font-semibold text-sm">Shared Inventory Pool</h4>
                      <p className="text-zinc-500 text-xs mt-1">
                        All tracks share the same edition limit. Buying any track reduces complete album availability.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">{releaseType === 'album' ? 'Album' : 'Track'} Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Enter ${releaseType} title`}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell listeners about this release..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                theme === 'dark' ? 'border-zinc-700 hover:border-blue-500/50' : 'border-zinc-300 hover:border-blue-500/50'
              }`}>
                <ImageIcon size={24} className="mx-auto text-zinc-500 mb-2" />
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Cover Art</p>
                <p className="text-zinc-500 text-sm">PNG or JPG, 1:1 ratio</p>
              </div>
            </>
          )}

          {step === 3 && releaseType === 'album' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Album Tracks</h3>
                <button onClick={addTrack} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                }`}>
                  <Plus size={16} /> Add Track
                </button>
              </div>
              <div className="space-y-3">
                {tracks.map((track, index) => (
                  <div key={track.id} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-800/30 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        theme === 'dark' ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                      }`}>{index + 1}</span>
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => updateTrack(track.id, 'title', e.target.value)}
                        placeholder="Track title"
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:border-blue-500 ${
                          theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                        }`}
                      />
                      <div className="relative w-28">
                        <input
                          type="number"
                          value={track.price}
                          onChange={(e) => updateTrack(track.id, 'price', Number(e.target.value))}
                          className={`w-full px-3 py-2 pr-12 text-sm text-right rounded-lg border transition-colors focus:outline-none focus:border-blue-500 ${
                            theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-black'
                          }`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">XRP</span>
                      </div>
                      {tracks.length > 1 && (
                        <button onClick={() => removeTrack(track.id)} className="p-2 text-zinc-500 hover:text-red-400">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer ${
                      theme === 'dark' ? 'border-zinc-700' : 'border-zinc-300'
                    }`}>
                      <p className="text-zinc-500 text-sm flex items-center justify-center gap-2">
                        <Upload size={14} /> Upload {mediaType === 'audio' ? 'MP3' : 'MP4'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {((step === 3 && releaseType === 'single') || (step === 4 && releaseType === 'album')) && (
            <>
              {releaseType === 'single' && (
                <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer group ${
                  theme === 'dark' ? 'border-zinc-700 hover:border-blue-500/50' : 'border-zinc-300 hover:border-blue-500/50'
                }`}>
                  <Upload size={28} className="mx-auto text-zinc-500 group-hover:text-blue-500 mb-2" />
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Drop your {mediaType === 'audio' ? 'MP3' : 'MP4'} here</p>
                  <p className="text-zinc-500 text-sm">or click to browse</p>
                </div>
              )}

              <div>
                <label className="block text-sm text-zinc-500 mb-2">Edition Size (Quantity)</label>
                <div className="flex items-center gap-4">
                  <input type="range" min="1" max="1000" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="flex-1" />
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

              {releaseType === 'single' && (
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">Price per NFT (XRP)</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inputClass} pl-12 pr-16`} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                  </div>
                </div>
              )}

              {releaseType === 'album' && (
                <div>
                  <label className="block text-sm text-zinc-500 mb-2">Album Bundle Price (XRP)</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input type="number" value={albumPrice || suggestedAlbumPrice} onChange={(e) => setAlbumPrice(Number(e.target.value))} className={`${inputClass} pl-12 pr-16`} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">XRP</span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-500">Platform Fee (2%)</span>
                  <span className={theme === 'dark' ? 'text-white' : 'text-black'}>2% on all sales</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">You Receive</span>
                  <span className="text-blue-500 font-medium">98% of each sale</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={`relative p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className={`px-6 py-3 rounded-xl font-medium transition-colors ${
              theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-black'
            }`}>Back</button>
          )}
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !title}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >Continue</button>
          ) : (
            <button
              onClick={handleMint}
              disabled={minting}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {minting ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Minting...</>
              ) : (
                <><Check size={18} /> Mint & List for Sale</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
